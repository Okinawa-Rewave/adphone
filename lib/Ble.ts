// my-app/lib/Ble.ts
import { Buffer } from "buffer";
import { Platform } from "react-native";
import {
  BleManager,
  State as BleState,
  Characteristic,
  Device,
  Subscription,
} from "react-native-ble-plx";
import {
  checkMultiple,
  PERMISSIONS,
  requestMultiple,
  RESULTS,
} from "react-native-permissions";
import type { Permission } from "react-native-permissions";

// シングルトン（アプリ全体で1個が安全）
const manager = new BleManager();

let connectedDevice: Device | null = null;
let disconnectSub: Subscription | null = null;
let monitorSub: Subscription | null = null;

type ConnectionChangeListener = (device: Device | null) => void;
const connectionChangeListeners = new Set<ConnectionChangeListener>();

function notifyConnectionChange(): void {
  connectionChangeListeners.forEach((cb) => {
    try {
      cb(connectedDevice);
    } catch {
      // listener 側の例外は握りつぶす
    }
  });
}

/** アプリ全体で 1 つの BleManager へのアクセサ（画面側で直接必要なとき用） */
export function getBleManager(): BleManager {
  return manager;
}

/** 受信 Notify の購読だけ止める（接続は維持） */
export function stopNotify(): void {
  monitorSub?.remove();
  monitorSub = null;
}

/** 接続状態の変化を購読（画面間で接続を共有するために使用） */
export function subscribeConnectionChange(
  callback: ConnectionChangeListener
): () => void {
  connectionChangeListeners.add(callback);
  // 現在の状態を即返す
  callback(connectedDevice);
  return () => {
    connectionChangeListeners.delete(callback);
  };
}

// ====== Helpers ======
const toBase64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const fromBase64 = (b64: string) => Buffer.from(b64, "base64").toString("utf8");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const api = Number(Platform.Version);

  // Android 12+
  if (api >= 31) {
    const perms: Permission[] = [
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    ];

    const statuses = await checkMultiple(perms);
    const need = perms.filter((p) => statuses[p] !== RESULTS.GRANTED);
    if (need.length === 0) return true;

    const req = await requestMultiple(need);
    return perms.every((p) => (req[p] ?? statuses[p]) === RESULTS.GRANTED);
  }

  // Android 11以下
  const perms: Permission[] = [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
  const statuses = await checkMultiple(perms);
  if (statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED) {
    return true;
  }
  const req = await requestMultiple(perms);
  return req[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED;
}

export async function getBleState(): Promise<BleState> {
  return await manager.state();
}

/**
 * 汎用スキャン
 * - name/localName/id に query が含まれるものだけ返す
 * - 見つけたら onFound に渡す（重複は呼ばない）
 */
export function scanDevices(params: {
  durationMs?: number;
  query?: string; // 例: "Adphone" / "raspberry" / ""（空で全件）
  onFound: (device: Device) => void;
  onError?: (msg: string) => void;
}): () => void {
  const { durationMs = 10_000, query = "", onFound, onError } = params;

  const q = query.trim().toLowerCase();
  const seen = new Set<string>();

  manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      onError?.(error.message);
      return;
    }
    if (!device) return;

    if (seen.has(device.id)) return;

    const name = (device.name ?? "").toLowerCase();
    const local = (device.localName ?? "").toLowerCase();
    const id = (device.id ?? "").toLowerCase();

    if (!q || name.includes(q) || local.includes(q) || id.includes(q)) {
      seen.add(device.id);
      onFound(device);
    }
  });

  const t = setTimeout(() => {
    try {
      manager.stopDeviceScan();
    } catch {}
  }, durationMs);

  // stop関数を返す
  return () => {
    clearTimeout(t);
    try {
      manager.stopDeviceScan();
    } catch {}
  };
}

/**
 * 接続
 * - まずリンク接続だけ完了させる
 * - 少し待ってからサービス発見をリトライ付きで実行
 * - SERVICE_DISCOVERY のタイムアウト対策
 */
export async function connect(deviceId: string): Promise<Device> {
  // 既存接続をクリーンアップ
  await disconnect().catch(() => {});

  // ① リンク接続のみ（サービス発見は後段）
  const d = await manager.connectToDevice(deviceId, {
    autoConnect: false,
    requestMTU: 185,
  });

  // ここで「接続成功」とみなす
  connectedDevice = d;

  // 切断監視
  disconnectSub?.remove();
  disconnectSub = manager.onDeviceDisconnected(d.id, () => {
    connectedDevice = null;
    monitorSub?.remove();
    monitorSub = null;
    notifyConnectionChange();
  });
  // ※ notifyConnectionChange はサービス発見成功後に呼ぶ（発見前に Notify 購読すると受信できない）

  // ② 少し待ってからサービス発見をリトライ
  await sleep(800);

  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      await d.discoverAllServicesAndCharacteristics();
      // サービス発見後に初めて「接続完了」として通知 → 画面で startNotifyText が動き、エコーが表示される
      notifyConnectionChange();
      return d;
    } catch (e) {
      lastErr = e;
      // 次のリトライまで待機（だんだん間隔を伸ばす）
      await sleep(800 * (i + 1));
    }
  }

  // ここまで来たらサービス発見は失敗とみなし、いったん切断
  await disconnect().catch(() => {});
  throw lastErr ?? new Error("Service discovery failed");
}

export function getConnectedDevice(): Device | null {
  return connectedDevice;
}

/**
 * 文字列送信（write）
 * - Raspberry Pi 側の Service/Characteristic に合わせる
 */
export async function writeText(params: {
  serviceUuid: string;
  charUuid: string; // write characteristic
  text: string;
  withResponse?: boolean; // default true
}): Promise<void> {
  if (!connectedDevice) throw new Error("Device not connected");

  const { serviceUuid, charUuid, text, withResponse = true } = params;

  const payload = toBase64(text);
  if (withResponse) {
    await connectedDevice.writeCharacteristicWithResponseForService(
      serviceUuid,
      charUuid,
      payload
    );
  } else {
    await connectedDevice.writeCharacteristicWithoutResponseForService(
      serviceUuid,
      charUuid,
      payload
    );
  }
}

/**
 * 文字列受信（notify/indicate）
 * - 受信したら onText を呼ぶ
 */
export async function startNotifyText(params: {
  serviceUuid: string;
  charUuid: string; // notify characteristic
  onText: (text: string) => void;
  onError?: (msg: string) => void;
}): Promise<void> {
  if (!connectedDevice) throw new Error("Device not connected");

  const { serviceUuid, charUuid, onText, onError } = params;

  // 既存の監視を解除
  monitorSub?.remove();
  monitorSub = null;

  monitorSub = connectedDevice.monitorCharacteristicForService(
    serviceUuid,
    charUuid,
    (error, characteristic: Characteristic | null) => {
      if (error) {
        onError?.(error.message);
        return;
      }
      const v = characteristic?.value;
      if (!v) return;

      try {
        onText(fromBase64(v));
      } catch (e: any) {
        onError?.(String(e?.message ?? e));
      }
    }
  );
}

export async function disconnect(): Promise<void> {
  monitorSub?.remove();
  monitorSub = null;

  disconnectSub?.remove();
  disconnectSub = null;

  if (!connectedDevice) return;

  const id = connectedDevice.id;
  connectedDevice = null;
  notifyConnectionChange();

  try {
    await manager.cancelDeviceConnection(id);
  } catch {
    // 無視してOK
  }
}

/**
 * 終了処理（アプリ終了時など）
 * ※ 通常は呼ばなくてOK（シングルトン運用）
 */
export function destroyBleManager(): void {
  try {
    manager.stopDeviceScan();
  } catch {}
  disconnect().catch(() => {});
  manager.destroy();
}
