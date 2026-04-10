import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Clock } from "lucide-react-native";
import { formatTimeAgo, getFreshnessColor } from "@/lib/formatTime";

interface Props {
  timestamp: number;
  lastSignatureAt?: number;
}

export function FreshnessIndicator({ timestamp, lastSignatureAt }: Props) {
  const color = getFreshnessColor(timestamp);
  return (
    <View style={styles.row}>
      <Clock size={11} color={color} strokeWidth={2} />
      <Text style={[styles.text, { color }]}>
        投稿: {formatTimeAgo(timestamp)}
      </Text>
      {lastSignatureAt != null && (
        <Text style={[styles.text, { color: getFreshnessColor(lastSignatureAt) }]}>
          　最終確認: {formatTimeAgo(lastSignatureAt)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontSize: 11, fontWeight: "500" },
});
