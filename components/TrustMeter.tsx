import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Design } from "@/constants/Design";
import type { TrustLevel } from "@/contexts/NotificationContext";

const FILL_COLOR: Record<TrustLevel, string> = {
  official:   Design.colors.trustOfficial,
  verified:   Design.colors.trustVerified,
  partial:    Design.colors.trustPartial,
  unverified: Design.colors.trustUnverified,
};

interface Props {
  score: number;       // 0〜100
  level: TrustLevel;
}

export function TrustMeter({ score, level }: Props) {
  const color = FILL_COLOR[level];
  const pct = Math.max(0, Math.min(100, score));
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>信頼度</Text>
        <Text style={[styles.score, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },
  score: {
    fontSize: 11,
    fontWeight: Design.fontWeight.bold,
  },
  track: {
    height: 4,
    backgroundColor: Design.colors.border,
    borderRadius: Design.radius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: Design.radius.full,
  },
});
