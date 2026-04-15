/**
 * BleToFeedBridge
 *
 * BLE受信メッセージ（receivedMessages）を監視し、プレフィックスで振り分ける:
 *   ADPH|... → NotificationContext のフィードに追加 + TrustMap へ投入（マップ反映）
 *   ADCH|... → LpwaChatContext に追加（LPWA チャット）
 *
 * 描画は行わない（null を返す）純粋な副作用コンポーネント。
 * _layout.tsx の RootOverlays に配置することで、すべてのコンテキストにアクセスできる。
 */

import { useEffect, useRef } from "react";
import { useBleContext } from "@/contexts/BleContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useDisasterReport } from "@/contexts/DisasterReportContext";
import { useLpwaChat } from "@/contexts/LpwaChatContext";
import { decodePayload, payloadToNotificationItem } from "@/lib/postPayload";
import { decodeChatMessage } from "@/lib/chatPayload";

export function BleToFeedBridge() {
  const { receivedMessages } = useBleContext();
  const { addItem } = useNotifications();
  const { ingestPacket } = useDisasterReport();
  const { addMessage } = useLpwaChat();

  const prevLengthRef = useRef(receivedMessages.length);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const currentLen = receivedMessages.length;

    if (currentLen <= prevLen) {
      prevLengthRef.current = currentLen;
      return;
    }

    const newMessages = receivedMessages.slice(0, currentLen - prevLen);
    prevLengthRef.current = currentLen;

    for (const msg of newMessages) {
      if (msg.startsWith("ADPH|")) {
        const payload = decodePayload(msg);
        if (!payload) continue;
        addItem(payloadToNotificationItem(payload));
        // 座標があれば共有 TrustMap に投入 → マップへ即時反映
        if (payload.lat != null && payload.lon != null) {
          void ingestPacket(payload);
        }
      } else if (msg.startsWith("ADCH|")) {
        const chatMsg = decodeChatMessage(msg);
        if (chatMsg) addMessage(chatMsg);
      }
    }
  }, [receivedMessages, addItem, ingestPacket, addMessage]);

  return null;
}
