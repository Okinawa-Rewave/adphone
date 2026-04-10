/**
 * BLE操作ロジック (react-native-ble-manager@12.4.5)
 *
 * RaspberryPi側: "Adphone" Peripheral
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
} from "react-native";
import BleManager, {
  BleDiscoverPeripheralEvent,
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
} from "react-native-ble-manager";

export const SERVICE_UUID = "ad000001-ad00-ad00-ad00-ad0000000001";
export const TX_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000002";
export const RX_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000003";
export const META_CHAR_UUID = "ad000001-ad00-ad00-ad00-ad0000000004";

export type BleState = "disconnected" | "scanning" | "connecting" | "connected";

export type BleDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
};

function bytesToString(bytes: number[]): string {
  try {
    // eslint-disable-next-line no-undef
    if (typeof TextDecoder !== "undefined") {
      // eslint-disable-next-line no-undef
      return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
    }
  } catch {
    // ignore
  }
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

function stringToBytes(str: string): number[] {
  try {
    // eslint-disable-next-line no-undef
    if (typeof TextEncoder !== "undefined") {
      // eslint-disable-next-line no-undef
      return Array.from(new TextEncoder().encode(str));
    }
  } catch {
    // ignore
  }
  const result: number[] = [];
  for (let i = 0; i < str.length; i++) result.push(str.charCodeAt(i) & 0xff);
  return result;
}

type ConnectedDevice = { id: string; name: string | null } | null;
type ConnectionChangeListener = (device: ConnectedDevice) => void;

const connectionListeners = new Set<ConnectionChangeListener>();
let _currentDevice: ConnectedDevice = null;

export function subscribeConnectionChange(
  listener: ConnectionChangeListener
): () => void {
  connectionListeners.add(listener);
  listener(_currentDevice);
  return () => connectionListeners.delete(listener);
}

function notifyConnectionChange(device: ConnectedDevice): void {
  _currentDevice = device;
  connectionListeners.forEach((l) => l(device));
}

let _managerStarted = false;
async function ensureStarted(): Promise<void> {
  if (_managerStarted) return;
  await BleManager.start({ showAlert: false });
  if (
    Platform.OS === "android" &&
    typeof (BleManager as any).enableBluetooth === "function"
  ) {
    try {
      await (BleManager as any).enableBluetooth();
    } catch {
      // ignore
    }
  }
  // BleManager.start() 完了後もBluetoothAdapterの準備に時間がかかる場合がある
  await new Promise<void>((r) => setTimeout(r, 300));
  _managerStarted = true;
}

async function ensureScanPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}


const BLE_DEBUG = true;
function dlog(...args: any[]) {
  if (!BLE_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

const MAX_MESSAGES = 200;

export function useBle() {
  const [bleState, setBleState] = useState<BleState>("disconnected");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [connectedCount, setConnectedCount] = useState<number>(0);
  const [discoveredDevices, setDiscoveredDevices] = useState<BleDevice[]>([]);

  const deviceIdRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const scanSessionRef = useRef(0);
  const discoverCountRef = useRef(0);

  const handleDidUpdateValue = useCallback(
    (event: BleManagerDidUpdateValueForCharacteristicEvent) => {
      const { characteristic, value } = event;
      if (characteristic.toLowerCase() === RX_CHAR_UUID.toLowerCase()) {
        setReceivedMessages((prev) => {
          const next = [bytesToString(value), ...prev];
          return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next;
        });
      } else if (characteristic.toLowerCase() === META_CHAR_UUID.toLowerCase()) {
        setConnectedCount(value[0] ?? 0);
      }
    },
    []
  );

  const handleDisconnect = useCallback(
    (event: BleDisconnectPeripheralEvent) => {
      if (event.peripheral !== deviceIdRef.current) return;
      deviceIdRef.current = null;
      setConnectedCount(0);
      setBleState("disconnected");
      notifyConnectionChange(null);
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    ensureStarted().catch(console.error);
    dlog("[BLE] useEffect: listeners registered");
    const subValue = BleManager.onDidUpdateValueForCharacteristic(handleDidUpdateValue);
    const subDisconnect = BleManager.onDisconnectPeripheral(handleDisconnect);
    return () => {
      mountedRef.current = false;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      dlog("[BLE] cleanup: listeners removed");
      subValue.remove();
      subDisconnect.remove();
    };
  }, [handleDidUpdateValue, handleDisconnect]);

  const startScan = useCallback(async () => {
    if (bleState !== "disconnected") return;

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    let subDiscover: { remove: () => void } | null = null;
    let subStop: { remove: () => void } | null = null;

    const cleanupScanListeners = () => {
      subDiscover?.remove();
      subStop?.remove();
      subDiscover = null;
      subStop = null;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
    try {
      await ensureStarted();
      dlog("[BLE] startScan: ensureStarted ok");
      const granted = await ensureScanPermissions();
      dlog("[BLE] startScan: permissions granted =", granted);
      if (!granted) {
        console.warn("[BLE] scan permission denied");
        setBleState("disconnected");
        return;
      }
      setDiscoveredDevices([]);
      setBleState("scanning");

      scanSessionRef.current += 1;
      discoverCountRef.current = 0;
      const session = scanSessionRef.current;
      dlog("[BLE] startScan: session", session, "BEGIN");

      subDiscover = BleManager.onDiscoverPeripheral(
        (peripheral: BleDiscoverPeripheralEvent) => {
          discoverCountRef.current += 1;
          const id: string = peripheral.id;
          const name: string | null =
            peripheral.name ?? (peripheral.advertising as any)?.localName ?? null;

          // Adphone のみ表示（取りこぼしを減らすため includes にする）
          if (!name) {
            if (discoverCountRef.current <= 10) {
              dlog("[BLE] discover:", id, "name=null (likely permission/stack)", {
                peripheralName: peripheral?.name,
                localName: peripheral?.advertising?.localName,
              });
            }
            return;
          }

          if (!name.includes("Adphone")) {
            if (discoverCountRef.current <= 10) {
              dlog("[BLE] discover:", id, "drop(name mismatch)", name);
            }
            return;
          }

          dlog("[BLE] discover:", id, "MATCH", name, "rssi=", peripheral.rssi ?? null);

          setDiscoveredDevices((prev) => {
            if (prev.some((d) => d.id === id)) return prev;
            return [
              ...prev,
              { id, name, rssi: peripheral.rssi ?? null },
            ];
          });
        }
      );

      subStop = BleManager.onStopScan(() => {
        cleanupScanListeners();
        if (!mountedRef.current) return;
        dlog("[BLE] stopScan event: session", session, "discoverEvents=", discoverCountRef.current);
        setBleState((s) => (s === "scanning" ? "disconnected" : s));
      });

      dlog("[BLE] scan call: session", session, "options", {
        seconds: 10,
        serviceUUIDs: [],
        allowDuplicates: false,
        scanMode: 2,
      });
      await BleManager.scan({
        seconds: 10,
        serviceUUIDs: [],
        allowDuplicates: false,
        scanMode: 2, // LowLatency
      } as any);
      dlog("[BLE] scan started: session", session);

      scanTimeoutRef.current = setTimeout(() => {
        scanTimeoutRef.current = null;
        if (!mountedRef.current) return;
        cleanupScanListeners();
        dlog("[BLE] scan timeout: session", session, "discoverEvents=", discoverCountRef.current);
        setBleState((s) => (s === "scanning" ? "disconnected" : s));
        try {
          BleManager.stopScan();
        } catch {
          // ignore
        }
      }, 11_000);
    } catch (err) {
      console.error("[BLE] scan error", err);
      if (mountedRef.current) setBleState("disconnected");
    }

    // NOTE: listeners are intentionally kept until stop/timeout/error.
    dlog("[BLE] startScan: armed listeners (will cleanup on stop/timeout)");
  }, [bleState]);

  const connectToDevice = useCallback(async (deviceId: string) => {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        setBleState("connecting");
        try {
          await BleManager.stopScan();
        } catch {
          // ignore
        }

        dlog(`[BLE] connect attempt ${attempt}/${MAX_ATTEMPTS}:`, deviceId);
        await BleManager.connect(deviceId);
        dlog("[BLE] connect: ok → retrieveServices");

        await BleManager.retrieveServices(deviceId);
        dlog("[BLE] retrieveServices: ok → wait 1000ms");
        await new Promise<void>((r) => setTimeout(r, 1000));

        dlog("[BLE] startNotification: RX");
        await BleManager.startNotification(deviceId, SERVICE_UUID, RX_CHAR_UUID);
        dlog("[BLE] startNotification: META");
        await BleManager.startNotification(deviceId, SERVICE_UUID, META_CHAR_UUID);
        dlog("[BLE] startNotification: all ok");

        if (
          Platform.OS === "android" &&
          typeof (BleManager as any).requestMTU === "function"
        ) {
          try {
            await (BleManager as any).requestMTU(deviceId, 247);
          } catch {
            // ignore
          }
        }

        deviceIdRef.current = deviceId;
        setDiscoveredDevices([]);
        setConnectedCount(1); // 暫定値。Pi の META Notify で正確な値に上書きされる
        setBleState("connected");
        notifyConnectionChange({ id: deviceId, name: "Adphone" });
        dlog("[BLE] connected:", deviceId);
        return; // 接続成功
      } catch (err) {
        console.error(`[BLE] connect error (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
        try {
          await BleManager.disconnect(deviceId);
        } catch {
          // ignore
        }
        if (attempt < MAX_ATTEMPTS) {
          // AndroidのBLEスタックがリセットされるのを待つ（短すぎると同じ結果になる）
          const waitMs = attempt === 1 ? 3000 : 6000;
          dlog(`[BLE] ${waitMs}ms 後にリトライ (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`);
          await new Promise<void>((r) => setTimeout(r, waitMs));
        } else {
          setBleState("disconnected");
          notifyConnectionChange(null);
        }
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    try {
      await BleManager.disconnect(id);
    } catch (err) {
      console.error("[BLE] disconnect error", err);
    } finally {
      deviceIdRef.current = null;
      setConnectedCount(0);
      setBleState("disconnected");
      notifyConnectionChange(null);
    }
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const id = deviceIdRef.current;
      if (!id || bleState !== "connected") return;
      try {
        await BleManager.write(id, SERVICE_UUID, TX_CHAR_UUID, stringToBytes(text), 512);
      } catch (err) {
        console.error("[BLE] write error", err);
      }
    },
    [bleState]
  );

  return {
    bleState,
    receivedMessages,
    connectedCount,
    discoveredDevices,
    startScan,
    connectToDevice,
    disconnect,
    sendText,
  };
}

