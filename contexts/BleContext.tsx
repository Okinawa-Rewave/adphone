/**
 * BleContext — BLE接続状態をアプリ全体で共有するコンテキスト
 *
 * useBle() をルートで一度だけ呼び出すことで、
 * 画面遷移してもBLE接続・受信リスナーが維持される。
 */

import React, { createContext, useContext } from "react";
import { useBle, BleDevice, BleState } from "@/lib/ble2";

type BleContextValue = {
  bleState: BleState;
  receivedMessages: string[];
  connectedCount: number;
  discoveredDevices: BleDevice[];
  startScan: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
};

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const ble = useBle();
  return <BleContext.Provider value={ble}>{children}</BleContext.Provider>;
}

export function useBleContext(): BleContextValue {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error("useBleContext must be used inside BleProvider");
  return ctx;
}
