/**
 * RegionalChatBubble — 地域チャットの3種メッセージバブル
 *   official : 公式（行政・避難所等）→ 青背景バナー付き
 *   other    : 一般ユーザー（他人）  → グレー背景・左寄せ
 *   mine     : 自分                  → primary青・右寄せ
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Shield, MapPin } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { formatHHMM } from "@/lib/formatTime";

export type BubbleVariant = "official" | "other" | "mine";

export interface RegionalMessage {
  id: string;
  text: string;
  senderName: string;
  senderIcon: string;
  senderId: string;
  location?: string;
  isOfficial?: boolean;
  createdAt?: any; // Firestore Timestamp or number
}

interface Props {
  message: RegionalMessage;
  myUid: string;
}

export function RegionalChatBubble({ message, myUid }: Props) {
  const isMine = message.senderId === myUid;
  const variant: BubbleVariant = message.isOfficial
    ? "official"
    : isMine
    ? "mine"
    : "other";

  const timeStr = message.createdAt
    ? formatHHMM(
        message.createdAt.toDate
          ? message.createdAt.toDate()
          : message.createdAt
      )
    : "";

  if (variant === "official") {
    return (
      <View style={styles.officialWrap}>
        {/* 公式バナーヘッダー */}
        <View style={styles.officialHeader}>
          <Shield size={13} color={Design.colors.trustOfficial} strokeWidth={2.5} />
          <Text style={styles.officialLabel}>公式情報</Text>
        </View>
        {/* 本文 */}
        <View style={styles.officialBody}>
          <View style={styles.metaRow}>
            <Text style={styles.officialSender}>{message.senderName}</Text>
            {message.location && (
              <View style={styles.locationRow}>
                <MapPin size={10} color={Design.colors.trustOfficial} strokeWidth={2} />
                <Text style={styles.officialLocation}>{message.location}</Text>
              </View>
            )}
            <Text style={styles.officialTime}>{timeStr}</Text>
          </View>
          <Text style={styles.officialText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  if (variant === "mine") {
    return (
      <View style={styles.mineRow}>
        <View style={styles.mineWrap}>
          {message.location && (
            <View style={[styles.locationRow, { justifyContent: "flex-end", marginBottom: 3 }]}>
              <MapPin size={10} color="rgba(255,255,255,0.7)" strokeWidth={2} />
              <Text style={styles.mineLocation}>{message.location}</Text>
            </View>
          )}
          <View style={styles.mineBubble}>
            <Text style={styles.mineText}>{message.text}</Text>
          </View>
          <Text style={styles.mineTime}>{timeStr}</Text>
        </View>
      </View>
    );
  }

  // other
  return (
    <View style={styles.otherRow}>
      {/* アバター */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{message.senderIcon}</Text>
      </View>
      <View style={styles.otherWrap}>
        <View style={styles.metaRow}>
          <Text style={styles.otherSender}>{message.senderName}</Text>
          {message.location && (
            <View style={styles.locationRow}>
              <MapPin size={10} color={Design.colors.textMuted} strokeWidth={2} />
              <Text style={styles.locationText}>{message.location}</Text>
            </View>
          )}
          <Text style={styles.otherTime}>{timeStr}</Text>
        </View>
        <View style={styles.otherBubble}>
          <Text style={styles.otherText}>{message.text}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── 公式 ───────────────────────────────────────────
  officialWrap: {
    marginVertical: Design.spacing.sm,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.trustOfficial + "40",
    overflow: "hidden",
  },
  officialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Design.colors.trustOfficialMuted,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.trustOfficial + "30",
  },
  officialLabel: {
    fontSize: 11,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.trustOfficial,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  officialBody: {
    backgroundColor: Design.colors.background,
    padding: Design.spacing.md,
    gap: 6,
  },
  officialSender: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.trustOfficial,
  },
  officialLocation: {
    fontSize: 11,
    color: Design.colors.trustOfficial,
  },
  officialTime: {
    fontSize: 11,
    color: Design.colors.textMuted,
    marginLeft: "auto",
  },
  officialText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    lineHeight: 22,
  },

  // ─── 自分 ────────────────────────────────────────────
  mineRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginVertical: 4,
    paddingLeft: 60,
  },
  mineWrap: { alignItems: "flex-end", gap: 2 },
  mineBubble: {
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    maxWidth: 280,
  },
  mineText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.white,
    lineHeight: 20,
  },
  mineLocation: { fontSize: 10, color: "rgba(255,255,255,0.75)" },
  mineTime: { fontSize: 10, color: Design.colors.textMuted },

  // ─── 他人 ────────────────────────────────────────────
  otherRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
    paddingRight: 60,
    gap: Design.spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  avatarText: { fontSize: 18 },
  otherWrap: { flex: 1, gap: 2 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  otherSender: {
    fontSize: 12,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textSecondary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  locationText: { fontSize: 11, color: Design.colors.textMuted },
  otherTime: { fontSize: 10, color: Design.colors.textMuted },
  otherBubble: {
    backgroundColor: Design.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    alignSelf: "flex-start",
    maxWidth: 280,
  },
  otherText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    lineHeight: 20,
  },
});
