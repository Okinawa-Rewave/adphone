/**
 * app/admin/users.tsx
 * 自治体ポータル — ユーザーごとの信頼度一覧
 */
import { useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications, type TrustLevel, type NotificationItem } from "@/contexts/NotificationContext";
import { TrustBadge } from "@/components/TrustBadge";
import { Design } from "@/constants/Design";

type UserStat = {
  author: string;
  reportCount: number;
  avgScore: number;
  dominantTrustLevel: TrustLevel;
  hasOfficial: boolean;
};

function getDominantTrustLevel(reports: NotificationItem[]): TrustLevel {
  const counts: Record<TrustLevel, number> = {
    official: 0,
    verified: 0,
    partial: 0,
    unverified: 0,
  };
  reports.forEach((x) => {
    if (x.trustLevel) counts[x.trustLevel]++;
  });
  const sorted = (Object.entries(counts) as [TrustLevel, number][]).sort(
    ([, a], [, b]) => b - a
  );
  return sorted[0][0];
}

function scoreBarColor(score: number): string {
  if (score >= 70) return Design.colors.trustVerified;
  if (score >= 40) return Design.colors.trustPartial;
  return Design.colors.trustUnverified;
}

export default function AdminUsers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useNotifications();

  // ユーザーごとに集計
  const userMap = new Map<string, NotificationItem[]>();
  items.forEach((item) => {
    const key = item.author ?? "不明";
    if (!userMap.has(key)) userMap.set(key, []);
    userMap.get(key)!.push(item);
  });

  const users: UserStat[] = Array.from(userMap.entries())
    .map(([author, reports]) => {
      const scored = reports.filter((x) => x.trustScore !== undefined);
      const avgScore =
        scored.length > 0
          ? Math.round(
              scored.reduce((s, x) => s + (x.trustScore ?? 0), 0) / scored.length
            )
          : 0;
      return {
        author,
        reportCount: reports.length,
        avgScore,
        dominantTrustLevel: getDominantTrustLevel(reports),
        hasOfficial: reports.some((x) => x.trustLevel === "official"),
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore || b.reportCount - a.reportCount);

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
        <Text style={styles.title}>ユーザー信頼度</Text>
        <Text style={styles.countLabel}>{users.length}名</Text>
      </View>

      {/* テーブルヘッダー */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colLabel, { width: 32 }]}>#</Text>
        <Text style={[styles.colLabel, { flex: 1 }]}>名前</Text>
        <Text style={[styles.colLabel, { width: 40, textAlign: "center" }]}>投稿</Text>
        <Text style={[styles.colLabel, { width: 90, textAlign: "center" }]}>信頼度スコア</Text>
        <Text style={[styles.colLabel, { width: 76 }]}>ステータス</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {users.map((u, i) => (
          <View key={u.author} style={[styles.row, i % 2 === 0 && styles.rowEven]}>
            {/* 順位 */}
            <Text style={[styles.rank, { width: 32 }]}>{i + 1}</Text>

            {/* 名前 */}
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName} numberOfLines={1}>
                {u.author}
              </Text>
              {u.hasOfficial && (
                <Text style={styles.officialTag}>公式機関</Text>
              )}
            </View>

            {/* 投稿数 */}
            <Text style={[styles.countText, { width: 40, textAlign: "center" }]}>
              {u.reportCount}
            </Text>

            {/* スコアバー */}
            <View style={{ width: 90, alignItems: "center", gap: 3 }}>
              <View style={styles.scoreBarTrack}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${u.avgScore}%`,
                      backgroundColor: scoreBarColor(u.avgScore),
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreText}>{u.avgScore} 点</Text>
            </View>

            {/* 信頼レベルバッジ */}
            <View style={{ width: 76 }}>
              <TrustBadge level={u.dominantTrustLevel} size="sm" />
            </View>
          </View>
        ))}
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
  countLabel: {
    width: 60,
    textAlign: "right",
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },

  // テーブルヘッダー
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    backgroundColor: Design.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  scroll: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.borderLight,
    minHeight: 56,
    gap: Design.spacing.xs,
  },
  rowEven: { backgroundColor: Design.colors.surface },

  rank: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textMuted,
  },
  authorName: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    fontWeight: Design.fontWeight.normal,
  },
  officialTag: {
    fontSize: 10,
    color: Design.colors.trustOfficial,
    fontWeight: Design.fontWeight.semi,
    marginTop: 1,
  },
  countText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textSecondary,
  },
  scoreBarTrack: {
    width: 70,
    height: 6,
    backgroundColor: Design.colors.surfaceElevated,
    borderRadius: Design.radius.full,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%", borderRadius: Design.radius.full },
  scoreText: {
    fontSize: 11,
    color: Design.colors.textMuted,
  },
});
