// app/index.tsx — ホーム（rewaveベースのフィード）
import React, { useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Phone, RefreshCw } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { MobileFrame } from "@/components/MobileFrame";
import { AppBar } from "@/components/AppBar";
import { BottomTab, BOTTOM_TAB_HEIGHT } from "@/components/BottomTab";
import { PostCard } from "@/components/PostCard";
import { useNotifications } from "@/contexts/NotificationContext";

const MIN_SPIN_MS = 500;

export default function HomeScreen() {
  const router = useRouter();
  const { items, markRead, signPost, toggleHelpful, refresh } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const handleRefresh = async () => {
    startedAtRef.current = Date.now();
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      const wait = Math.max(0, MIN_SPIN_MS - elapsed);
      setTimeout(() => setRefreshing(false), wait);
    }
  };

  const handlePress = (id: string, href?: string) => {
    markRead(id);
    if (href) router.push(href as any);
  };

  return (
    <MobileFrame>
      <AppBar title="Adphone" showBack={false} />

      {/* フィルタータブ（現在地 / 全国） */}
      <View style={styles.filterBar}>
        <View style={styles.filterTabActive}>
          <Text style={styles.filterTextActive}>現在地周辺</Text>
        </View>
        <TouchableOpacity style={styles.filterTab}>
          <Text style={styles.filterText}>全国</Text>
        </TouchableOpacity>

        {/* 緊急電話ボタン群 */}
        <View style={styles.spacer} />
        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL("tel:110")}>
          <Phone size={13} color={Design.colors.danger} strokeWidth={2.5} />
          <Text style={styles.callText}>110</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL("tel:119")}>
          <Phone size={13} color={Design.colors.danger} strokeWidth={2.5} />
          <Text style={styles.callText}>119</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.refreshBtn, refreshing && { opacity: 0.5 }]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={15} color={Design.colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* フィード */}
      <ScrollView
        contentContainerStyle={[styles.feed, { paddingBottom: BOTTOM_TAB_HEIGHT + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>現在、この地域の災害情報はありません</Text>
          </View>
        ) : (
          items.map((item) => (
            <PostCard
              key={item.id}
              item={item}
              onPress={() => handlePress(item.id, item.href)}
              onSign={() => signPost(item.id)}
              onHelpful={() => toggleHelpful(item.id)}
            />
          ))
        )}
        {/* もっと見るリンクは不要（全件表示）*/}
      </ScrollView>

      <BottomTab />
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    gap: Design.spacing.xs,
    backgroundColor: Design.colors.background,
  },
  filterTab: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 6,
    borderRadius: Design.radius.full,
  },
  filterTabActive: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 6,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.primary,
  },
  filterText: { fontSize: 13, color: Design.colors.textMuted, fontWeight: Design.fontWeight.semi },
  filterTextActive: { fontSize: 13, color: Design.colors.white, fontWeight: Design.fontWeight.semi },
  spacer: { flex: 1 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 5,
    borderRadius: Design.radius.full,
    borderWidth: 1,
    borderColor: Design.colors.danger + "60",
    backgroundColor: Design.colors.dangerMuted,
  },
  callText: { fontSize: 12, color: Design.colors.danger, fontWeight: Design.fontWeight.bold },
  refreshBtn: {
    padding: 6,
    borderRadius: Design.radius.full,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  feed: {
    padding: Design.spacing.md,
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
});
