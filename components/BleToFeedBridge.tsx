/**
 * BleToFeedBridge
 *
 * BLE受信メッセージ（receivedMessages）を監視し、プレフィックスで振り分ける:
 *   ADPH|... → NotificationContext のフィードに追加（災害投稿）
 *   ADCH|... → LpwaChatContext に追加（LPWA チャット）
 *
 * 描画は行わない（null を返す）純粋な副作用コンポーネント。
 * _layout.tsx の RootOverlays に配置することで、すべてのコンテキストにアクセスできる。
 */

import { useEffect, useRef } from "react";
import { useBleContext } from "@/contexts/BleContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLpwaChat } from "@/contexts/LpwaChatContext";
import { useDisasterReport } from "@/contexts/DisasterReportContext";
import { decodePayload, payloadToNotificationItem } from "@/lib/postPayload";
import {
  computeFeedTrustForPostPayload,
  ingestPostPayloadIntoTrustMap,
} from "@/lib/trustFeedSync";
import { decodeChatMessage } from "@/lib/chatPayload";

export function BleToFeedBridge() {
  const { receivedMessages } = useBleContext();
  const { addItem } = useNotifications();
  const { addMessage } = useLpwaChat();
  const { refreshScores } = useDisasterReport();

  // 前回の receivedMessages の長さを記録し、新着だけを処理する
  const prevLengthRef = useRef(receivedMessages.length);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const currentLen = receivedMessages.length;

    if (currentLen <= prevLen) {
      prevLengthRef.current = currentLen;
      return;
    }

    // receivedMessages は新着が先頭に prepend される（ble2.ts）
    const newMessages = receivedMessages.slice(0, currentLen - prevLen);
    prevLengthRef.current = currentLen;

    for (const msg of newMessages) {
      if (msg.startsWith("ADPH|")) {
        const payload = decodePayload(msg);
        if (payload) {
          ingestPostPayloadIntoTrustMap(payload);
          refreshScores();
          const { trustLevel, trustScore } = computeFeedTrustForPostPayload(payload);
          addItem(
            payloadToNotificationItem(payload, { trustLevel, trustScore })
          );
        }
      } else if (msg.startsWith("ADCH|")) {
        const chatMsg = decodeChatMessage(msg);
        if (chatMsg) addMessage(chatMsg);
      }
    }
  }, [receivedMessages, addItem, addMessage, refreshScores]);

  return null;
}
