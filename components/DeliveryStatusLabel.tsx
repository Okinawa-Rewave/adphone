/**
 * DeliveryStatusLabel — LPWA で送ったメッセージの配送状態を 1 行で表示する
 *
 * 状態は Raspberry Pi が BLE で返す（lib/ble2.ts の deliveryStatus）。
 * 全体（ブロードキャスト）宛ては ACK がないので、「近くの局が中継」が最終の状態になる。
 */

import React from "react";
import { StyleSheet, Text } from "react-native";
import { Design } from "@/constants/Design";
import type { DeliveryInfo, DeliveryState } from "@/lib/ble2";

const LABELS: Record<DeliveryState, { text: string; color: string }> = {
  sending: { text: "送信中…", color: Design.colors.textMuted },
  queued: { text: "中継局が受け付けました", color: Design.colors.textMuted },
  sent: { text: "送信しました", color: Design.colors.textMuted },
  relayed: { text: "近くの局が中継しました", color: Design.colors.trustVerified },
  delivered: { text: "相手に届きました", color: Design.colors.trustVerified },
  waiting: { text: "まだ届いていません（中継局が送り直します）", color: Design.colors.warning },
  failed: { text: "届きませんでした", color: Design.colors.danger },
};

export function DeliveryStatusLabel({ info, align = "right" }: { info: DeliveryInfo; align?: "left" | "right" }) {
  const { text, color } = LABELS[info.state];
  const hops = info.state === "delivered" && info.hops ? `（${info.hops} ホップ）` : "";
  return (
    <Text
      style={[styles.label, { color, textAlign: align }]}
      accessibilityLabel={`配送状態: ${text}${hops}`}
    >
      {text}
      {hops}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: Design.fontSize.caption,
    marginTop: 2,
    marginBottom: Design.spacing.xs,
    paddingHorizontal: Design.spacing.sm,
  },
});
