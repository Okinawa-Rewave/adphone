// app/notifications.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { MobileFrame } from "@/components/MobileFrame";
import { ArrowLeft, Check } from "lucide-react-native";
import { BrowserHeader } from "@/components/BrowserHeader";


type NotificationItem = {
  id: string;
  text: string;
  time: string;      // "12:34" みたいな表示用
  unread: boolean;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", text: "◯◯さんからメッセージを受信しました", time: "12:01", unread: true },
  { id: "n2", text: "××にメッセージを送信しました", time: "11:48", unread: false },
  { id: "n3", text: "ネットワークに接続しました", time: "11:20", unread: true },
  { id: "n4", text: "オフラインになりました", time: "10:55", unread: false },
];

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = useMemo(
    () => items.filter((x) => x.unread).length,
    [items]
  );

  const markAllRead = () => {
    setItems((prev) => prev.map((x) => ({ ...x, unread: false })));
  };

  const toggleRead = (id: string) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, unread: !x.unread } : x))
    );
  };

  return (
    <MobileFrame>
      <View style={styles.container}>
        {/* ヘッダー（Homeと同じトーン） */}
        <BrowserHeader />
        <View style={styles.header}>          
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#111827" />
            <Text style={styles.backText}>戻る</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>通知</Text>
            <Text style={styles.subtitle}>未読 {unreadCount} 件</Text>
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={markAllRead}>
            <Check size={18} color="#111827" />
            <Text style={styles.actionText}>全て既読</Text>
          </TouchableOpacity>
        </View>

        {/* 一覧 */}
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.row, n.unread && styles.rowUnread]}
              onPress={() => toggleRead(n.id)}
              activeOpacity={0.8}
            >
              <View style={styles.left}>
                <Text style={styles.text} numberOfLines={2}>
                  • {n.text}
                </Text>
                <Text style={styles.time}>{n.time}</Text>
              </View>

              {/* 未読ドット */}
              {n.unread ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotHidden} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 下部ヒント */}
        <View style={styles.footerHint}>
          <Text style={styles.footerText}>※通知をタップすると既読/未読を切り替えます</Text>
        </View>
      </View>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingRight: 8 },
  backText: { marginLeft: 4, fontSize: 14, color: "#4b5563" },

  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#6b7280" },

  actionButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 8, paddingVertical: 4 },
  actionText: { fontSize: 12, color: "#111827", fontWeight: "600" },

  list: { padding: 12, paddingBottom: 24 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",          // Homeの通知エリアと近い色
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowUnread: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
  },

  left: { flex: 1, paddingRight: 10 },
  text: { fontSize: 16, color: "#6b7280" }, // Homeで大きくしたフォントに寄せた
  time: { marginTop: 6, fontSize: 12, color: "#9ca3af" },

  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  unreadDotHidden: { width: 10, height: 10, borderRadius: 5, backgroundColor: "transparent" },

  footerHint: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  footerText: { fontSize: 12, color: "#9ca3af" },
});
