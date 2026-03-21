import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useNotifications } from "@/contexts/NotificationContext";
import { Check } from "lucide-react-native";

export default function NotificationsScreen() {
  const { items, unreadCount, markAllRead, toggleRead } = useNotifications();

  return (
    <ScreenLayout
      title="通知"
      subtitle={unreadCount > 0 ? `未読 ${unreadCount} 件` : undefined}
      rightAction={
        <TouchableOpacity
          onPress={markAllRead}
          style={styles.actionButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Check size={20} color={Design.colors.text} />
          <Text style={styles.actionText}>全て既読</Text>
        </TouchableOpacity>
      }
      contentStyle={styles.content}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <Text style={styles.emptyText}>通知はありません</Text>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, n.unread && styles.rowUnread]}
              onPress={() => toggleRead(n.id)}
              activeOpacity={0.7}
            >
              <View style={styles.left}>
                <Text style={styles.text} numberOfLines={2}>
                  • {n.text}
                </Text>
                <Text style={styles.time}>{n.time}</Text>
              </View>
              {n.unread ? (
                <View style={styles.unreadDot} />
              ) : (
                <View style={styles.unreadDotHidden} />
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.footerHint}>
        <Text style={styles.footerText}>
          通知をタップすると既読／未読を切り替えます
        </Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Design.spacing.lg,
    paddingTop: Design.spacing.lg,
  },
  list: {
    paddingBottom: Design.spacing.xxl,
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    paddingVertical: Design.spacing.xxl,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.lg,
    marginBottom: Design.spacing.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  rowUnread: {
    backgroundColor: Design.colors.primaryMuted,
    borderColor: Design.colors.border,
  },
  left: {
    flex: 1,
    paddingRight: Design.spacing.md,
  },
  text: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
  },
  time: {
    marginTop: Design.spacing.xs,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Design.colors.danger,
  },
  unreadDotHidden: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.xs,
    paddingVertical: Design.spacing.xs,
    paddingLeft: Design.spacing.sm,
  },
  actionText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
  footerHint: {
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    backgroundColor: Design.colors.surface,
    marginHorizontal: -Design.spacing.lg,
    marginBottom: -Design.spacing.lg,
  },
  footerText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
});
