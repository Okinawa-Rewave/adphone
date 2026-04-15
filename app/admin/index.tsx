/**
 * app/admin/index.tsx
 * 自治体ポータル — ダッシュボード概要
 */
import { useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications, type DisasterType, type TrustLevel } from "@/contexts/NotificationContext";
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

const DISASTER_COLORS: Record<DisasterType, string> = {
  earthquake: Design.colors.disasterEarthquake,
  flood: Design.colors.disasterFlood,
  fire: Design.colors.disasterFire,
  collapse: Design.colors.disasterCollapse,
  landslide: Design.colors.disasterLandslide,
  other: Design.colors.disasterOther,
};

const ALL_TYPES: DisasterType[] = ["earthquake", "flood", "fire", "collapse", "landslide", "other"];

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useNotifications();

  const disasterItems = items.filter((x) => x.disasterType);
  const total = disasterItems.length;
  const officialCount = items.filter((x) => x.trustLevel === "official").length;
  const verifiedCount = items.filter((x) => x.trustLevel === "verified").length;
  const scored = items.filter((x) => x.trustScore !== undefined);
  const avgTrust =
    scored.length > 0
      ? Math.round(scored.reduce((s, x) => s + (x.trustScore ?? 0), 0) / scored.length)
      : 0;

  const typeCounts = ALL_TYPES.map((t) => ({
    type: t,
    label: DISASTER_LABELS[t],
    count: disasterItems.filter((x) => x.disasterType === t).length,
    color: DISASTER_COLORS[t],
  }));
  const maxCount = Math.max(...typeCounts.map((t) => t.count), 1);

  const recentTop = [...items]
    .filter((x) => x.trustScore !== undefined && x.disasterType)
    .sort((a, b) => (b.trustScore ?? 0) - (a.trustScore ?? 0))
    .slice(0, 3);

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
        <Text style={styles.title}>ダッシュボード</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 統計カード */}
        <View style={styles.statsGrid}>
          <StatCard label="総報告数" value={String(total)} unit="件" color={Design.colors.primary} />
          <StatCard label="公式発表" value={String(officialCount)} unit="件" color={Design.colors.trustOfficial} />
          <StatCard label="確認済み" value={String(verifiedCount)} unit="件" color={Design.colors.trustVerified} />
          <StatCard label="平均信頼度" value={String(avgTrust)} unit="点" color={Design.colors.warning} />
        </View>

        {/* 災害種別集計 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>災害種別 集計</Text>
          {typeCounts.map(({ type, label, count, color }) => (
            <View key={type} style={styles.barRow}>
              <Text style={styles.barLabel}>{label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(count / maxCount) * 100}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{count}</Text>
            </View>
          ))}
        </View>

        {/* 高信頼度の最新情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>高信頼度の最新情報</Text>
          {recentTop.length === 0 && (
            <Text style={styles.emptyText}>データがありません</Text>
          )}
          {recentTop.map((item) => (
            <View key={item.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportAuthor}>{item.author ?? "不明"}</Text>
                {item.trustLevel && <TrustBadge level={item.trustLevel} size="sm" />}
              </View>
              <Text style={styles.reportText} numberOfLines={2}>
                {item.text}
              </Text>
              <View style={styles.reportFooter}>
                <Text style={styles.reportMeta}>{item.location ?? "場所不明"}</Text>
                <Text style={styles.reportScore}>信頼度 {item.trustScore ?? "—"}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>
        {value}
        <Text style={styles.statUnit}>{unit}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  scroll: { flex: 1 },

  // 統計グリッド
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Design.spacing.md,
    gap: Design.spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    padding: Design.spacing.md,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: Design.fontWeight.bold },
  statUnit: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.normal,
    color: Design.colors.textMuted,
  },
  statLabel: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    marginTop: 2,
  },

  // セクション
  section: {
    paddingHorizontal: Design.spacing.md,
    paddingBottom: Design.spacing.lg,
  },
  sectionTitle: {
    fontSize: Design.fontSize.subtitle,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
    marginBottom: Design.spacing.md,
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    textAlign: "center",
    paddingVertical: Design.spacing.lg,
  },

  // 棒グラフ
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Design.spacing.sm,
    gap: Design.spacing.sm,
  },
  barLabel: { width: 56, fontSize: Design.fontSize.caption, color: Design.colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: Design.colors.surfaceElevated,
    borderRadius: Design.radius.full,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: Design.radius.full },
  barCount: {
    width: 24,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    textAlign: "right",
  },

  // 最新情報カード
  reportCard: {
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    padding: Design.spacing.md,
    marginBottom: Design.spacing.sm,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reportAuthor: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textSecondary,
  },
  reportText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  reportFooter: { flexDirection: "row", justifyContent: "space-between" },
  reportMeta: { fontSize: 11, color: Design.colors.textMuted },
  reportScore: { fontSize: 11, color: Design.colors.textMuted },
});
