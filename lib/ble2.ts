/**
 * BLE操作ロジック (スタブ実装)
 *
 * 一時的に react-native-ble-manager を切り離し、ダミー実装に置き換えています。
 * BLE機能を再度有効化する場合は、git履歴から元の実装を復元してください。
 */

import { useCallback, useState } from "react";

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

type ConnectedDevice = { id: string; name: string | null } | null;
type ConnectionChangeListener = (device: ConnectedDevice) => void;

const connectionListeners = new Set<ConnectionChangeListener>();
let _currentDevice: ConnectedDevice = null;

export function subscribeConnectionChange(
  listener: ConnectionChangeListener
): () => void {
  connectionListeners.add(listener);
  listener(_currentDevice);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function useBle() {
  const [bleState] = useState<BleState>("disconnected");
  const [receivedMessages] = useState<string[]>([]);
  const [connectedCount] = useState<number>(0);
  const [discoveredDevices] = useState<BleDevice[]>([]);

  const startScan = useCallback(async () => {
    console.warn("[BLE stub] startScan called - BLE is disabled");
  }, []);

  const connectToDevice = useCallback(async (_deviceId: string) => {
    console.warn("[BLE stub] connectToDevice called - BLE is disabled");
  }, []);

  const disconnect = useCallback(async () => {
    console.warn("[BLE stub] disconnect called - BLE is disabled");
  }, []);

  const sendText = useCallback(async (_text: string) => {
    console.warn("[BLE stub] sendText called - BLE is disabled");
  }, []);

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