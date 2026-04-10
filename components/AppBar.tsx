/**
 * AppBar — BrowserHeader + AppHeader を統合した新ヘッダー
 *
 * 構成:
 *   showBack=false（タブ画面）: [BLE●]  タイトル  [🔔N] [👤]
 *   showBack=true（詳細画面）:  [◀戻る]  タイトル  [🔔N] [👤]
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Bell, User, Bluetooth } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { useBleContext } from "@/contexts/BleContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useUI } from "@/contexts/UIContext";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function AppBar({ title, subtitle, showBack = false, rightAction }: Props) {
  const router = useRouter();
  const { bleState } = useBleContext();
  const { unreadCount } = useNotifications();
  const { openSideDrawer } = useUI();

  const bleConnected = bleState === "connected";

  return (
    <View style={styles.bar}>
      {/* ── 左側 ── */}
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <ChevronLeft size={20} color={Design.colors.text} strokeWidth={2.2} />
            <Text style={styles.backText}>戻る</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.bleIndicator}
            onPress={() => router.push("/settings/adphone" as any)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Bluetooth size={14} color={bleConnected ? Design.colors.success : Design.colors.textMuted} strokeWidth={2.2} />
            <View style={[styles.bleDot, { backgroundColor: bleConnected ? Design.colors.success : Design.colors.textMuted }]} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── 中央：タイトル ── */}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {/* ── 右側 ── */}
      <View style={styles.right}>
        {rightAction ?? (
          <>
            {/* 通知ベル */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/notifications" as any)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Bell size={20} color={Design.colors.text} strokeWidth={2} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ユーザーアイコン → サイドドロワー */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={openSideDrawer}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <View style={styles.avatar}>
                <User size={16} color={Design.colors.textSecondary} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Design.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  left: { width: 80, flexDirection: "row", alignItems: "center" },
  center: { flex: 1, alignItems: "center" },
  right: { width: 80, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: Design.fontSize.body, color: Design.colors.text, fontWeight: Design.fontWeight.semi },

  bleIndicator: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  bleDot: { width: 7, height: 7, borderRadius: 4 },

  title: { fontSize: Design.fontSize.title, fontWeight: Design.fontWeight.bold, color: Design.colors.text },
  subtitle: { fontSize: 12, color: Design.colors.textMuted, marginTop: 1 },

  iconBtn: { position: "relative", padding: 4 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Design.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: Design.colors.white, fontWeight: Design.fontWeight.bold },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Design.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
