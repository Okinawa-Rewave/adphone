/**
 * BleToFeedBridge
 *
 * BLE で受信したメッセージを 1 件ずつ受け取り、プレフィックスで振り分ける:
 *   ADPH|... → NotificationContext のフィードに追加（災害投稿）
 *   ADCH|... → LpwaChatContext に追加（LPWA チャット）
 *
 * 描画は行わない（null を返す）純粋な副作用コンポーネント。
 * _layout.tsx の RootOverlays に配置することで、すべてのコンテキストにアクセスできる。
 *
 * 以前は receivedMessages の長さの増分で新着を検出していたが、上限（200 件）に達すると
 * 長さが増えなくなり新着を取りこぼしていた。subscribeMessages で 1 件ずつ受け取る。
 */

import { useEffect, useRef } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLpwaChat } from "@/contexts/LpwaChatContext";
import { useDisasterReport } from "@/contexts/DisasterReportContext";
import { subscribeMessages } from "@/lib/ble2";
import { decodePayload, payloadToNotificationItem } from "@/lib/postPayload";
import {
  computeFeedTrustForPostPayload,
  ingestPostPayloadIntoTrustMap,
} from "@/lib/trustFeedSync";
import { decodeChatMessage } from "@/lib/chatPayload";

export function BleToFeedBridge() {
  const { addItem } = useNotifications();
  const { addMessage } = useLpwaChat();
  const { refreshScores } = useDisasterReport();

  // 購読し直さずに最新のコールバックを使う
  const handlers = useRef({ addItem, addMessage, refreshScores });
  handlers.current = { addItem, addMessage, refreshScores };

  useEffect(() => {
    return subscribeMessages(({ text }) => {
      const h = handlers.current;
      if (text.startsWith("ADPH|")) {
        const payload = decodePayload(text);
        if (payload) {
          ingestPostPayloadIntoTrustMap(payload);
          h.refreshScores();
          const { trustLevel, trustScore } = computeFeedTrustForPostPayload(payload);
          h.addItem(payloadToNotificationItem(payload, { trustLevel, trustScore }));
        }
      } else if (text.startsWith("ADCH|")) {
        const chatMsg = decodeChatMessage(text);
        if (chatMsg) h.addMessage(chatMsg);
      }
    });
  }, []);

  return null;
}
