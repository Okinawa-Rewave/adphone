/**
 * BLE 通信（react-native-ble-plx）— ADREN の Raspberry Pi（BLE 名 "Adphone"）とつなぐ
 *
 * プロトコルは BLE v2（lib/bleProtocol.ts / Raspberry/lpwa/mesh/bleproto.py）:
 * - 接続したら HELLO（端末 ID と、この Pi から最後に受け取った連番）を送る。
 *   Pi は不在の間に届いたメッセージと、こちらが送ったメッセージの最新の配送状態を返す
 * - 送ったメッセージには Pi から配送状態（受付・送信済み・中継された・届いた・再送待ち・届かず）が返る
 *
 * 接続・組み立て・保存はモジュール内のシングルトン（client）が持ち、useBle() はその状態を購読するだけ。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, type Subscription } from "react-native-ble-plx";
import {
  BROADCAST,
  Kind,
  Reassembler,
  chunk,
  decodeFrame,
  encodeFrame,
  fromBase64,
  helloPayload,
  statusToState,
  toBase64,
  utf8Decode,
  utf8Encode,
  type DeliveryState,
  type Frame,
} from "@/lib/bleProtocol";

export const SERVICE_UUID = "ad000001-ad00-ad00-ad00-ad0000000001";
export const TX_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000002";
export const RX_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000003";
export const META_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000004";

export type { DeliveryState } from "@/lib/bleProtocol";
export { BROADCAST } from "@/lib/bleProtocol";

export type BleState = "disconnected" | "scanning" | "connecting" | "connected";

export type BleDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
};

export type DeliveryInfo = {
  state: DeliveryState;
  /** 届いたときのホップ数（分かる場合） */
  hops?: number;
  updatedAt: number;
};

/** Pi が HELLO に返す情報 */
export type PiInfo = {
  addr: number;
  name?: string;
  routing?: string;
  hop_limit?: number;
  group?: boolean;
  fingerprint?: string;
  last_seq?: number;
};

export type MeshNode = {
  addr: number;
  name: string;
  role: string;
  hops: number | null;
  heard_sec: number | null;
};

export type ReceivedMessage = {
  /** Pi の受信箱の連番 */
  seq: number;
  /** 送信元ノードのアドレス */
  src: number;
  /** 宛先（BROADCAST = 全体） */
  dest: number;
  text: string;
};

export type SendOptions = {
  /** 宛先ノードのアドレス。省略すると全体（ブロードキャスト） */
  to?: number;
  /** 配送状態を引くためのキー。省略すると自動で作る */
  key?: string;
};

type Snapshot = {
  bleState: BleState;
  connectedCount: number;
  discoveredDevices: BleDevice[];
  /** 受信したメッセージ本文（新しい順, 最大 MAX_MESSAGES 件） */
  receivedMessages: string[];
  deliveryStatus: Record<string, DeliveryInfo>;
  piInfo: PiInfo | null;
  nodes: MeshNode[];
};

const MAX_MESSAGES = 200;
const MAX_TRACKED = 200;
const SCAN_SECONDS = 10;
const DEVICE_NAMES = ["Adphone", "ADREN"];

const KEY_CLIENT_ID = "adren.ble.clientId";
const KEY_LAST_SEQ = "adren.ble.lastSeq";
const KEY_TRACKED = "adren.ble.tracked";

const BLE_DEBUG = __DEV__;
function dlog(...args: unknown[]) {
  if (BLE_DEBUG) console.log("[BLE]", ...args);
}

type ConnectedDevice = { id: string; name: string | null } | null;
type ConnectionChangeListener = (device: ConnectedDevice) => void;
type MessageListener = (msg: ReceivedMessage) => void;

class AdrenBleClient {
  private manager: BleManager | null = null;
  private snap: Snapshot = {
    bleState: "disconnected",
    connectedCount: 0,
    discoveredDevices: [],
    receivedMessages: [],
    deliveryStatus: {},
    piInfo: null,
    nodes: [],
  };
  private listeners = new Set<() => void>();
  private connectionListeners = new Set<ConnectionChangeListener>();
  private messageListeners = new Set<MessageListener>();

  private deviceId: string | null = null;
  private deviceName: string | null = null;
  private stream = 1;
  private reasm = new Reassembler();
  private subs: Subscription[] = [];
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  private clientId: Uint8Array | null = null;
  private lastSeq: Record<string, number> = {};
  /** アプリの msg_id → 配送状態のキー（挿入順 = 古い順） */
  private tracked = new Map<number, string>();
  private loaded: Promise<void> | null = null;

  // ── 購読（useSyncExternalStore 用） ──────────────────────
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  subscribeConnectionChange(l: ConnectionChangeListener): () => void {
    this.connectionListeners.add(l);
    l(this.deviceId ? { id: this.deviceId, name: this.deviceName } : null);
    return () => {
      this.connectionListeners.delete(l);
    };
  }

  subscribeMessages(l: MessageListener): () => void {
    this.messageListeners.add(l);
    return () => {
      this.messageListeners.delete(l);
    };
  }

  private notifyConnection() {
    const d = this.deviceId ? { id: this.deviceId, name: this.deviceName } : null;
    this.connectionListeners.forEach((l) => l(d));
  }

  // ── 保存しておく値 ──────────────────────────────────────
  private load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const [cid, seq, tracked] = await Promise.all([
            AsyncStorage.getItem(KEY_CLIENT_ID),
            AsyncStorage.getItem(KEY_LAST_SEQ),
            AsyncStorage.getItem(KEY_TRACKED),
          ]);
          if (cid && /^[0-9a-f]{16}$/.test(cid)) {
            this.clientId = Uint8Array.from(cid.match(/../g)!.map((h) => parseInt(h, 16)));
          } else {
            this.clientId = Uint8Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
            await AsyncStorage.setItem(
              KEY_CLIENT_ID,
              Array.from(this.clientId, (b) => b.toString(16).padStart(2, "0")).join("")
            );
          }
          this.lastSeq = seq ? JSON.parse(seq) : {};
          const t = tracked ? JSON.parse(tracked) : {};
          this.tracked = new Map<number, string>(Array.isArray(t.ids) ? t.ids : []);
          this.set({ deliveryStatus: t.status ?? {} });
        } catch (err) {
          console.warn("[BLE] 保存した値を読めませんでした", err);
          this.clientId ??= Uint8Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
        }
      })();
    }
    return this.loaded;
  }

  private saveTracked() {
    // 古いものから捨てて上限件数に収める
    for (const id of this.tracked.keys()) {
      if (this.tracked.size <= MAX_TRACKED) break;
      this.tracked.delete(id);
    }
    const keep = new Set(this.tracked.values());
    const status = Object.fromEntries(
      Object.entries(this.snap.deliveryStatus).filter(([k]) => keep.has(k))
    );
    AsyncStorage.setItem(
      KEY_TRACKED,
      JSON.stringify({ ids: Array.from(this.tracked.entries()), status })
    ).catch(() => {});
  }

  private saveLastSeq() {
    AsyncStorage.setItem(KEY_LAST_SEQ, JSON.stringify(this.lastSeq)).catch(() => {});
  }

  private getManager(): BleManager {
    this.manager ??= new BleManager();
    return this.manager;
  }

  // ── スキャン ────────────────────────────────────────────
  startScan = async () => {
    if (this.snap.bleState !== "disconnected") return;
    try {
      if (!(await ensurePermissions())) {
        console.warn("[BLE] Bluetooth の権限がありません");
        return;
      }
      await this.load();
      const manager = this.getManager();
      this.set({ discoveredDevices: [], bleState: "scanning" });
      await manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.warn("[BLE] scan error", error.message);
          this.stopScan();
          return;
        }
        if (!device) return;
        const name = device.name ?? device.localName ?? null;
        if (!name || !DEVICE_NAMES.some((n) => name.includes(n))) return;
        if (this.snap.discoveredDevices.some((d) => d.id === device.id)) return;
        dlog("discover", device.id, name, device.rssi);
        this.set({
          discoveredDevices: [...this.snap.discoveredDevices, { id: device.id, name, rssi: device.rssi }],
        });
      });
      this.scanTimer = setTimeout(() => this.stopScan(), SCAN_SECONDS * 1000);
    } catch (err) {
      console.error("[BLE] scan error", err);
      this.set({ bleState: "disconnected" });
    }
  };

  private stopScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    this.manager?.stopDeviceScan().catch(() => {});
    if (this.snap.bleState === "scanning") this.set({ bleState: "disconnected" });
  }

  // ── 接続 ────────────────────────────────────────────────
  connectToDevice = async (deviceId: string) => {
    const manager = this.getManager();
    await this.load();
    this.stopScan();
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        this.set({ bleState: "connecting" });
        dlog(`connect ${attempt}/${MAX_ATTEMPTS}`, deviceId);
        const device = await manager.connectToDevice(
          deviceId,
          Platform.OS === "android" ? { requestMTU: 247 } : undefined
        );
        await device.discoverAllServicesAndCharacteristics();

        this.deviceId = deviceId;
        this.deviceName = device.name ?? "Adphone";
        this.stream = 1 + Math.floor(Math.random() * 255);
        this.reasm = new Reassembler();
        this.subs.forEach((s) => s.remove());
        this.subs = [
          manager.monitorCharacteristicForDevice(deviceId, SERVICE_UUID, RX_CHAR_UUID, (err, c) => {
            if (err || !c?.value) return;
            this.onNotify(fromBase64(c.value));
          }),
          manager.monitorCharacteristicForDevice(deviceId, SERVICE_UUID, META_CHAR_UUID, (err, c) => {
            if (err || !c?.value) return;
            this.set({ connectedCount: fromBase64(c.value)[0] ?? 0 });
          }),
          manager.onDeviceDisconnected(deviceId, () => this.onDisconnected()),
        ];

        this.set({ bleState: "connected", discoveredDevices: [], connectedCount: 1 });
        this.notifyConnection();
        await this.writeFrame({
          kind: Kind.HELLO,
          msgId: 0,
          src: 0,
          dest: BROADCAST,
          payload: helloPayload(this.clientId!, this.lastSeq[deviceId] ?? 0),
        });
        dlog("connected", deviceId, "stream", this.stream);
        return;
      } catch (err) {
        console.error(`[BLE] connect error (${attempt}/${MAX_ATTEMPTS})`, err);
        await manager.cancelDeviceConnection(deviceId).catch(() => {});
        if (attempt < MAX_ATTEMPTS) {
          // Android の BLE スタックが落ち着くのを待つ（短すぎると同じ失敗を繰り返す）
          await new Promise<void>((r) => setTimeout(r, attempt === 1 ? 3000 : 6000));
        }
      }
    }
    this.onDisconnected();
  };

  disconnect = async () => {
    const id = this.deviceId;
    if (!id) return;
    try {
      await this.getManager().cancelDeviceConnection(id);
    } catch (err) {
      console.error("[BLE] disconnect error", err);
    } finally {
      this.onDisconnected();
    }
  };

  private onDisconnected() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.deviceId = null;
    this.set({ bleState: "disconnected", connectedCount: 0, piInfo: null });
    this.notifyConnection();
  }

  // ── 送信 ────────────────────────────────────────────────
  private writeFrame(frame: Frame): Promise<void> {
    const id = this.deviceId;
    if (!id) return Promise.reject(new Error("not connected"));
    const chunks = chunk(encodeFrame(frame), this.stream);
    // フレームのチャンクが他のフレームと混ざらないよう、書き込みを 1 列に並べる
    const run = this.writeChain.then(async () => {
      for (const c of chunks) {
        await this.getManager().writeCharacteristicWithResponseForDevice(
          id,
          SERVICE_UUID,
          TX_CHAR_UUID,
          toBase64(c)
        );
      }
    });
    this.writeChain = run.catch(() => {});
    return run;
  }

  /**
   * テキストを送る。戻り値は配送状態（deliveryStatus）を引くキー。未接続なら null。
   */
  sendText = async (text: string, opts: SendOptions = {}): Promise<string | null> => {
    if (!this.deviceId || this.snap.bleState !== "connected") return null;
    let msgId = 0;
    while (msgId === 0 || this.tracked.has(msgId)) msgId = Math.floor(Math.random() * 0xffffffff);
    const key = opts.key ?? `ble-${msgId}`;
    this.tracked.set(msgId, key);
    this.setStatus(key, { state: "sending" });
    try {
      await this.writeFrame({
        kind: Kind.MSG,
        msgId,
        src: 0,
        dest: opts.to ?? BROADCAST,
        payload: utf8Encode(text),
      });
    } catch (err) {
      console.error("[BLE] write error", err);
      this.setStatus(key, { state: "failed" });
    }
    return key;
  };

  requestNodes = async () => {
    if (!this.deviceId) return;
    await this.writeFrame({ kind: Kind.NODES_REQ, msgId: 0, src: 0, dest: BROADCAST, payload: new Uint8Array() }).catch(
      (err) => console.error("[BLE] write error", err)
    );
  };

  private setStatus(key: string, info: Omit<DeliveryInfo, "updatedAt">) {
    this.set({
      deliveryStatus: { ...this.snap.deliveryStatus, [key]: { ...info, updatedAt: Date.now() } },
    });
    this.saveTracked();
  }

  // ── 受信 ────────────────────────────────────────────────
  private onNotify(data: Uint8Array) {
    const got = this.reasm.add(data);
    if (!got) return;
    const frame = decodeFrame(got.frame);
    if (!frame) return;
    switch (frame.kind) {
      case Kind.MSG:
        this.onMessage(frame);
        break;
      case Kind.STATUS: {
        const key = this.tracked.get(frame.msgId);
        const state = statusToState(frame.payload[0]);
        if (key && state) {
          this.setStatus(key, { state, hops: frame.payload.length > 1 ? frame.payload[1] : undefined });
        }
        break;
      }
      case Kind.INFO: {
        const info = parseJson<PiInfo>(frame.payload);
        if (!info) break;
        // Pi の受信箱が作り直された → 連番を最初から数え直す
        if (this.deviceId && info.last_seq !== undefined && info.last_seq < (this.lastSeq[this.deviceId] ?? 0)) {
          this.lastSeq[this.deviceId] = 0;
          this.saveLastSeq();
        }
        this.set({ piInfo: info });
        break;
      }
      case Kind.NODES:
        this.set({ nodes: parseJson<MeshNode[]>(frame.payload) ?? [] });
        break;
    }
  }

  private onMessage(frame: Frame) {
    const dev = this.deviceId;
    if (dev) {
      if (frame.msgId <= (this.lastSeq[dev] ?? 0)) return; // 受け取り済み
      this.lastSeq[dev] = frame.msgId;
      this.saveLastSeq();
    }
    const msg: ReceivedMessage = {
      seq: frame.msgId,
      src: frame.src,
      dest: frame.dest,
      text: utf8Decode(frame.payload),
    };
    this.set({ receivedMessages: [msg.text, ...this.snap.receivedMessages].slice(0, MAX_MESSAGES) });
    this.messageListeners.forEach((l) => l(msg));
  }
}

function parseJson<T>(b: Uint8Array): T | null {
  try {
    return JSON.parse(utf8Decode(b)) as T;
  } catch {
    return null;
  }
}

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Platform.Version >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      r[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      r[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

const client = new AdrenBleClient();

export function subscribeConnectionChange(listener: ConnectionChangeListener): () => void {
  return client.subscribeConnectionChange(listener);
}

/** 受信したメッセージを 1 件ずつ受け取る（履歴の回収分も含む） */
export function subscribeMessages(listener: MessageListener): () => void {
  return client.subscribeMessages(listener);
}

export function useBle() {
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot);
  return {
    ...snap,
    startScan: client.startScan,
    connectToDevice: client.connectToDevice,
    disconnect: client.disconnect,
    sendText: client.sendText,
    requestNodes: client.requestNodes,
  };
}
