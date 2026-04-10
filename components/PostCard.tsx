import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MapPin, CheckCircle2, ThumbsUp, Eye, Wifi } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustMeter } from "@/components/TrustMeter";
import { DisasterIcon } from "@/components/DisasterIcon";
import { FreshnessIndicator } from "@/components/FreshnessIndicator";
import { SignatureChain } from "@/components/SignatureChain";
import type { NotificationItem } from "@/contexts/NotificationContext";

interface Props {
  item: NotificationItem;
  onPress?: () => void;
  onSign?: () => void;
  onHelpful?: () => void;
}

export function PostCard({ item, onPress, onSign, onHelpful }: Props) {
  const trust = item.trustLevel ?? "unverified";
  const score = item.trustScore ?? 0;
  const lastSig = item.signatures?.length
    ? Math.max(...item.signatures.map((s) => s.timestamp))
    : undefined;

  return (
    <TouchableOpacity
      style={[styles.card, item.unread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* ── ヘッダー ── */}
      <View style={styles.header}>
        {item.disasterType ? (
          <DisasterIcon type={item.disasterType} size="md" />
        ) : (
          <View style={styles.defaultIcon}>
            <Wifi size={18} color={Design.colors.success} strokeWidth={2} />
          </View>
        )}
        <View style={styles.headerMeta}>
          <View style={styles.headerTop}>
            {item.location && (
              <View style={styles.locationRow}>
                <MapPin size={11} color={Design.colors.textMuted} strokeWidth={2} />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>
            )}
            {item.unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.author}>{item.author ?? "不明"}</Text>
        </View>
      </View>

      {/* ── 公式バナー ── */}
      {trust === "official" && (
        <View style={styles.officialBanner}>
          <CheckCircle2 size={12} color={Design.colors.trustOfficial} strokeWidth={2.5} />
          <Text style={styles.officialText}>公式確認済み</Text>
        </View>
      )}

      {/* ── 本文 ── */}
      <Text style={styles.body} numberOfLines={4}>{item.text}</Text>

      {/* ── 信頼度セクション ── */}
      <View style={styles.trustSection}>
        <View style={styles.trustRow}>
          <TrustBadge level={trust} size="sm" />
          {item.nearbyConfirmations != null && item.nearbyConfirmations > 0 && (
            <View style={styles.nearbyBadge}>
              <MapPin size={10} color={Design.colors.trustVerified} strokeWidth={2} />
              <Text style={styles.nearbyText}>
                半径内 {item.nearbyConfirmations} 端末
              </Text>
            </View>
          )}
        </View>
        <TrustMeter score={score} level={trust} />
        {item.signatures && item.signatures.length > 0 && (
          <SignatureChain signatures={item.signatures} />
        )}
        {item.timestamp != null && (
          <FreshnessIndicator timestamp={item.timestamp} lastSignatureAt={lastSig} />
        )}
      </View>

      {/* ── アクションバー ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            style={[styles.actionBtn, item.hasSigned && styles.actionBtnSigned]}
            onPress={onSign}
            activeOpacity={0.7}
          >
            <CheckCircle2
              size={15}
              color={item.hasSigned ? Design.colors.trustVerified : Design.colors.textMuted}
              strokeWidth={2}
            />
            <Text style={[styles.actionText, item.hasSigned && { color: Design.colors.trustVerified }]}>
              現地一致
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, item.isHelpful && styles.actionBtnHelpful]}
            onPress={onHelpful}
            activeOpacity={0.7}
          >
            <ThumbsUp
              size={15}
              color={item.isHelpful ? Design.colors.trustPartial : Design.colors.textMuted}
              strokeWidth={2}
            />
            <Text style={[styles.actionText, item.isHelpful && { color: Design.colors.trustPartial }]}>
              役立つ {item.helpfulCount ? `${item.helpfulCount}` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {item.impressions != null && (
          <View style={styles.impressions}>
            <Eye size={13} color={Design.colors.textMuted} strokeWidth={2} />
            <Text style={styles.impressionsText}>{item.impressions}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    overflow: "hidden",
    marginBottom: Design.spacing.md,
  },
  cardUnread: {
    borderColor: Design.colors.primary + "60",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Design.spacing.sm,
    padding: Design.spacing.md,
    paddingBottom: Design.spacing.sm,
  },
  defaultIcon: {
    width: 42,
    height: 42,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.successMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMeta: { flex: 1, gap: 2 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 12, color: Design.colors.textMuted },
  author: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Design.colors.danger,
  },
  officialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Design.colors.trustOfficialMuted,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Design.colors.trustOfficial + "30",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 6,
  },
  officialText: {
    fontSize: 12,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.trustOfficial,
  },
  body: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    lineHeight: 22,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  trustSection: {
    paddingHorizontal: Design.spacing.md,
    paddingBottom: Design.spacing.sm,
    gap: Design.spacing.sm,
  },
  trustRow: { flexDirection: "row", alignItems: "center", gap: Design.spacing.sm },
  nearbyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Design.colors.trustVerifiedMuted,
    borderRadius: Design.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearbyText: { fontSize: 11, color: Design.colors.trustVerified, fontWeight: Design.fontWeight.semi },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Design.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: Design.spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 5,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  actionBtnSigned: { borderColor: Design.colors.trustVerified, backgroundColor: Design.colors.trustVerifiedMuted },
  actionBtnHelpful: { borderColor: Design.colors.trustPartial, backgroundColor: Design.colors.trustPartialMuted },
  actionText: { fontSize: 12, color: Design.colors.textMuted, fontWeight: Design.fontWeight.semi },
  impressions: { flexDirection: "row", alignItems: "center", gap: 3 },
  impressionsText: { fontSize: 11, color: Design.colors.textMuted },
});
