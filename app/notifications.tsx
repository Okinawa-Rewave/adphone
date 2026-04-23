// app/notifications.tsx — タイムライン表示（rewaveベース）
import React, { useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";
import { PostCard } from "@/components/PostCard";
import { useNotifications } from "@/contexts/NotificationContext";
import type { NotificationItem } from "@/contexts/NotificationContext";

type Group = { label: string; items: NotificationItem[] };

function groupByTime(items: NotificationItem[]): Group[] {
  const now = Date.now();
  const groups: Group[] = [
    { label: "直近15分",   items: [] },
    { label: "1時間以内",  items: [] },
    { label: "1時間以上前",items: [] },
  ];

  for (const item of items) {
    const ts = item.timestamp ?? now;
    const diff = (now - ts) / 60000;
    if (diff < 15)    groups[0].items.push(item);
    else if (diff < 60) groups[1].items.push(item);
    else              groups[2].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, unreadCount, markAllRead, markRead, signPost, toggleHelpful, disagreePost } = useNotifications();
  const groups = useMemo(() => groupByTime(items), [items]);

  const handlePress = (id: string, href?: string) => {
    markRead(id);
    if (href) router.push(href as any);
  };

  return (
    <ScreenLayout
      title="タイムライン"
      subtitle={unreadCount > 0 ? `未読 ${unreadCount} 件` : undefined}
      showBack={false}
      showBottomTab
      rightAction={
        <TouchableOpacity
          onPress={markAllRead}
          style={styles.allReadBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Check size={18} color={Design.colors.text} />
          <Text style={styles.allReadText}>既読</Text>
        </TouchableOpacity>
      }
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>通知はありません</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.label} style={styles.group}>
              {/* グループヘッダー */}
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{group.items.length}</Text>
                </View>
              </View>

              {/* PostCardリスト */}
              <View style={styles.groupItems}>
                {group.items.map((item) => (
                  <PostCard
                    key={item.id}
                    item={item}
                    onPress={() => handlePress(item.id, item.href)}
                    onSign={() => signPost(item.id)}
                    onHelpful={() => toggleHelpful(item.id)}
                    onDisagree={() => disagreePost(item.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: Design.spacing.md,
  },
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    textAlign: "center",
  },
  group: {
    marginBottom: Design.spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  groupLabel: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textSecondary,
  },
  groupBadge: {
    backgroundColor: Design.colors.surfaceElevated,
    borderRadius: Design.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  groupBadgeText: {
    fontSize: 11,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },
  groupItems: {
    paddingHorizontal: Design.spacing.md,
  },
  allReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingLeft: Design.spacing.sm,
  },
  allReadText: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
});
