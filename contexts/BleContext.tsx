/**
 * BleContext — BLE接続状態をアプリ全体で共有するコンテキスト
 *
 * useBle() をルートで一度だけ呼び出すことで、
 * 画面遷移してもBLE接続・受信リスナーが維持される。
 */

import React, { createContext, useContext } from "react";
import {
  useBle,
  type BleDevice,
  type BleState,
  type DeliveryInfo,
  type MeshNode,
  type PiInfo,
  type SendOptions,
} from "@/lib/ble2";

type BleContextValue = {
  bleState: BleState;
  receivedMessages: string[];
  connectedCount: number;
  discoveredDevices: BleDevice[];
  /** 送ったメッセージの配送状態（sendText が返したキー → 状態） */
  deliveryStatus: Record<string, DeliveryInfo>;
  /** つないでいる Pi の情報（未接続なら null） */
  piInfo: PiInfo | null;
  /** メッシュのノード一覧（requestNodes で更新） */
  nodes: MeshNode[];
  startScan: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** 送る。戻り値は deliveryStatus を引くキー（未接続なら null） */
  sendText: (text: string, opts?: SendOptions) => Promise<string | null>;
  requestNodes: () => Promise<void>;
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
