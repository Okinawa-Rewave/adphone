import { useEffect, useState } from "react";
import { subscribeConnectionChange } from "@/lib/ble2";

/**
 * アドフォン BLE 接続状態をどこからでも参照できるフック。
 * ble.ts のシングルトンリスナーに乗るだけなので、
 * 複数コンポーネントで同時に使っても問題ない。
 */
export function useBleConnected(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeConnectionChange((device) => {
      setConnected(device !== null);
    });
    return unsub;
  }, []);

  return connected;
}
