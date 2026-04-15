/**
 * app/admin/reports.tsx
 * 自治体ポータル — 地域別報告一覧（信頼度フィルタ付き）
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  ChevronLeft,
  Activity,
  Droplets,
  Flame,
  Building2,
  Mountain,
  AlertCircle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNotifications,
  type DisasterType,
  type TrustLevel,
} from "@/contexts/NotificationContext";
import { TrustBadge } from "@/components/TrustBadge";
import { Design } from "@/constants/Design";

const DISASTER_LABELS: Record<DisasterType, string> = {
  earthquake: "地震",
  flood: "洪水",
  fire: "火災",
  collapse: "倒壊",
  landslide: "土砂崩れ",
  other: "その他",
};

const DISASTER_ICONS: Record<DisasterType, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  earthquake: Activity,
  flood: Droplets,
  fire: Flame,
  collapse: Building2,
  landslide: Mountain,
  other: AlertCircle,
};

const DISASTER_COLORS: Record<DisasterType, string> = {
  earthquake: Design.colors.disasterEarthquake,
  flood: Design.colors.disasterFlood,
  fire: Design.colors.disasterFire,
  collapse: Design.colors.disasterCollapse,
  landslide: Design.colors.disasterLandslide,
  other: Design.colors.disasterOther,
};

type FilterKey = TrustLevel | "all";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all",        label: "すべて" },
  { key: "official",   label: "公式" },
  { key: "verified",   label: "確認済" },
  { key: "partial",    label: "一部確認" },
  { key: "unverified", label: "未確認" },
];

export default function AdminReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>("all");

  const displayItems = items
    .filter((x) => x.disasterType)
    .filter((x) => filter === "all" || x.trustLevel === filter)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={Design.colors.text} strokeWidth={2.2} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>報告一覧</Text>
        <Text style={styles.countBadge}>{displayItems.length}件</Text>
      </View>

      {/* フィルターバー */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 報告リスト */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {displayItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>該当する報告がありません</Text>
          </View>
        )}
        {displayItems.map((item) => {
          const dType = item.disasterType!;
          const Icon = DISASTER_ICONS[dType];
          const color = DISASTER_COLORS[dType];
          const timeStr = item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : item.time;

          return (
            <View key={item.id} style={styles.card}>
              {/* 災害種別アイコン */}
              <View style={[styles.typeIcon, { backgroundColor: color + "22" }]}>
                <Icon size={18} color={color} strokeWidth={2} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardType, { color }]}>
                    {DISASTER_LABELS[dType]}
                  </Text>
                  {item.trustLevel && (
                    <TrustBadge level={item.trustLevel} size="sm" />
                  )}
                </View>
                <Text style={styles.cardText} numberOfLines={2}>
                  {item.text}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>{item.author ?? "不明"}</Text>
                  {item.location && (
                    <Text style={styles.metaText}> · {item.location}</Text>
                  )}
                  {item.trustScore !== undefined && (
                    <Text style={styles.metaText}> · 信頼度 {item.trustScore}</Text>
                  )}
                  <View style={{ flex: 1 }} />
                  <Text style={styles.metaTime}>{timeStr}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: Design.spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    minHeight: 52,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    fontWeight: Design.fontWeight.semi,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  countBadge: {
    width: 60,
    textAlign: "right",
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },

  // フィルター
  filterBar: {
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
  },
  filterContent: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    gap: Design.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 6,
    borderRadius: Design.radius.full,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.surface,
  },
  filterChipActive: {
    backgroundColor: Design.colors.primary,
    borderColor: Design.colors.primary,
  },
  filterLabel: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textSecondary,
    fontWeight: Design.fontWeight.semi,
  },
  filterLabelActive: { color: Design.colors.white },

  // リスト
  scroll: { flex: 1 },
  emptyState: { padding: Design.spacing.xxl, alignItems: "center" },
  emptyText: { fontSize: Design.fontSize.body, color: Design.colors.textMuted },
  card: {
    flexDirection: "row",
    padding: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.borderLight,
    gap: Design.spacing.sm,
    alignItems: "flex-start",
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: Design.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  cardBody: { flex: 1 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardType: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
  cardText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaText: { fontSize: 11, color: Design.colors.textMuted },
  metaTime: { fontSize: 11, color: Design.colors.textMuted },
});
