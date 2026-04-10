import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronDown, ChevronUp, Shield, Users } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { formatTimeAgo } from "@/lib/formatTime";
import type { Signature } from "@/contexts/NotificationContext";

const TYPE_LABEL: Record<Signature["type"], string> = {
  government:     "行政機関",
  fire_department:"消防団",
  local_defense:  "地域防災士",
  user:           "一般ユーザー",
};

interface Props {
  signatures: Signature[];
}

export function SignatureChain({ signatures }: Props) {
  const [open, setOpen] = useState(false);
  const officialCount = signatures.filter((s) => s.isOfficial).length;
  const firstOfficial = signatures.find((s) => s.isOfficial);
  const preview = firstOfficial ?? signatures[0];

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          {officialCount > 0 ? (
            <Shield size={13} color={Design.colors.trustOfficial} strokeWidth={2} />
          ) : (
            <Users size={13} color={Design.colors.textMuted} strokeWidth={2} />
          )}
          <Text style={styles.preview} numberOfLines={1}>
            {preview ? preview.name : "確認なし"}
            {signatures.length > 1 ? `  +${signatures.length - 1}件` : ""}
          </Text>
        </View>
        {open ? (
          <ChevronUp size={14} color={Design.colors.textMuted} />
        ) : (
          <ChevronDown size={14} color={Design.colors.textMuted} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.list}>
          {signatures.map((sig) => (
            <View
              key={sig.id}
              style={[styles.sigRow, sig.isOfficial && styles.sigRowOfficial]}
            >
              <View style={[styles.dot, { backgroundColor: sig.isOfficial ? Design.colors.trustOfficial : Design.colors.border }]} />
              <View style={styles.sigInfo}>
                <Text style={[styles.sigName, sig.isOfficial && styles.sigNameOfficial]}>
                  {sig.name}
                </Text>
                <Text style={styles.sigMeta}>
                  {TYPE_LABEL[sig.type]} · {formatTimeAgo(sig.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Design.colors.surfaceElevated,
    borderRadius: Design.radius.sm,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 6,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  preview: { fontSize: 12, color: Design.colors.textSecondary, flex: 1 },
  list: {
    paddingLeft: Design.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Design.colors.border,
    gap: 8,
  },
  sigRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  sigRowOfficial: {},
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  sigInfo: { flex: 1 },
  sigName: { fontSize: 12, fontWeight: Design.fontWeight.semi, color: Design.colors.text },
  sigNameOfficial: { color: Design.colors.trustOfficial },
  sigMeta: { fontSize: 11, color: Design.colors.textMuted, marginTop: 2 },
});
