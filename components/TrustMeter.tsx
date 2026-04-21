import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
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
  animated?: boolean;
}

export function TrustMeter({ score, level, animated = false }: Props) {
  const color = FILL_COLOR[level];
  const pct = Math.max(0, Math.min(100, score));

  const animValue = useRef(new Animated.Value(pct)).current;
  const [displayPct, setDisplayPct] = useState(pct);

  useEffect(() => {
    if (!animated) {
      animValue.setValue(pct);
      setDisplayPct(pct);
      return;
    }
    const id = animValue.addListener(({ value }) => setDisplayPct(Math.round(value)));
    Animated.timing(animValue, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
    return () => animValue.removeListener(id);
  }, [pct, animated]);

  const widthInterp = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>信頼度</Text>
        <Text style={[styles.score, { color }]}>{animated ? displayPct : pct}%</Text>
      </View>
      <View style={styles.track}>
        {animated ? (
          <Animated.View style={[styles.fill, { width: widthInterp, backgroundColor: color }]} />
        ) : (
          <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
        )}
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
