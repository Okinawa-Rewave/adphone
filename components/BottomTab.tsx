/**
 * BottomTab — rewaveベースの5タブ + 中央FABナビゲーション
 * タブ: ホーム / マップ / [📷 FAB] / チャット / 設定
 * FAB は CreatePostModal を開く
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Map as MapIcon, Plus, MessageSquare, Settings } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { useUI } from "@/contexts/UIContext";

export const BOTTOM_TAB_HEIGHT = 56;

const TABS = [
  { label: "ホーム",  Icon: Home,         href: "/"         },
  { label: "マップ",  Icon: MapIcon,       href: "/map"      },
  { label: null,      Icon: Plus,          href: null        }, // FAB
  { label: "チャット",Icon: MessageSquare, href: "/chat"     },
  { label: "設定",   Icon: Settings,      href: "/settings" },
] as const;

/** BottomTab を表示すべきパス */
const TAB_ROOTS = ["/", "/map", "/chat", "/settings"];

export function useShowBottomTab(): boolean {
  const pathname = usePathname();
  return TAB_ROOTS.some((r) =>
    r === "/" ? pathname === "/" : pathname.startsWith(r)
  );
}

export function BottomTab() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { openCreatePost } = useUI();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((tab, i) => {
        if (tab.href === null) {
          // FAB（中央）
          return (
            <TouchableOpacity
              key="fab"
              style={styles.fabWrap}
              onPress={openCreatePost}
              activeOpacity={0.85}
            >
              <View style={styles.fab}>
                <tab.Icon size={26} color={Design.colors.white} strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          );
        }
        const active = isActive(tab.href);
        return (
          <TouchableOpacity
            key={tab.href}
            style={styles.tab}
            onPress={() => router.push(tab.href as any)}
            activeOpacity={0.7}
          >
            <tab.Icon
              size={22}
              color={active ? Design.colors.primary : Design.colors.textMuted}
              strokeWidth={active ? 2.3 : 1.8}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Design.colors.background,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingBottom: 4,
  },
  fabWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: Design.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  label: { fontSize: 10, color: Design.colors.textMuted, fontWeight: Design.fontWeight.semi },
  labelActive: { color: Design.colors.primary },
});
