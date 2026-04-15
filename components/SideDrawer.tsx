/**
 * SideDrawer — X（旧Twitter）スタイルの右スライドドロワー
 * ボトムタブに無い機能へのアクセスを提供する
 */
import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Bell,
  Bot,
  Camera,
  Package,
  BookOpen,
  Phone,
  Bluetooth,
  Building2,
  X,
  ChevronRight,
} from "lucide-react-native";
import { Design } from "@/constants/Design";
import { useUI } from "@/contexts/UIContext";
import { useBleContext } from "@/contexts/BleContext";

const DRAWER_WIDTH = Dimensions.get("window").width * 0.78;

const MENU_ITEMS = [
  { label: "プロフィール",     href: "/settings/profile",             Icon: User,      section: "main" },
  { label: "通知一覧",         href: "/notifications",                Icon: Bell,      section: "main" },
  { label: "AIアシスタント",   href: "/ai",                           Icon: Bot,       section: "disaster" },
  { label: "カメラ（人物検出）", href: "/camera",                      Icon: Camera,    section: "disaster" },
  { label: "防災グッズ確認",   href: "/disaster/checklist",           Icon: Package,   section: "disaster" },
  { label: "行動マニュアル",   href: "/disaster/manual",              Icon: BookOpen,  section: "disaster" },
  { label: "緊急連絡先",       href: "/disaster/emergency-contacts",  Icon: Phone,     section: "disaster" },
  { label: "アドフォン設定",   href: "/settings/adphone",             Icon: Bluetooth, section: "device" },
  { label: "自治体ポータル",   href: "/admin",                        Icon: Building2, section: "admin" },
] as const;

export function SideDrawer() {
  const { isSideDrawerOpen, closeSideDrawer } = useUI();
  const { bleState, connectedCount } = useBleContext();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSideDrawerOpen ? 0 : DRAWER_WIDTH,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isSideDrawerOpen, slideAnim]);

  const navigate = (href: string) => {
    closeSideDrawer();
    setTimeout(() => router.push(href as any), 50);
  };

  const bleConnected = bleState === "connected";

  const sections = [
    { key: "main",    label: "アカウント" },
    { key: "disaster",label: "防災機能" },
    { key: "device",  label: "デバイス" },
    { key: "admin",   label: "管理" },
  ];

  return (
    <Modal
      visible={isSideDrawerOpen}
      transparent
      animationType="none"
      onRequestClose={closeSideDrawer}
      statusBarTranslucent
    >
      {/* 背景オーバーレイ */}
      <TouchableWithoutFeedback onPress={closeSideDrawer}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* ドロワー本体（右からスライドイン） */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        {/* クローズボタン */}
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>メニュー</Text>
          <TouchableOpacity onPress={closeSideDrawer} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={Design.colors.text} />
          </TouchableOpacity>
        </View>

        {/* BLE ステータスカード */}
        <TouchableOpacity style={styles.bleCard} onPress={() => navigate("/settings/adphone")} activeOpacity={0.8}>
          <View style={[styles.bleDot, { backgroundColor: bleConnected ? Design.colors.success : Design.colors.textMuted }]} />
          <View style={styles.bleInfo}>
            <Text style={styles.bleTitle}>
              {bleConnected ? "BLE 接続中" : "BLE 未接続"}
            </Text>
            {bleConnected && (
              <Text style={styles.bleSubtitle}>{connectedCount} 台接続</Text>
            )}
          </View>
          <ChevronRight size={16} color={Design.colors.textMuted} />
        </TouchableOpacity>

        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {sections.map((sec) => {
            const sectionItems = MENU_ITEMS.filter((m) => m.section === sec.key);
            return (
              <View key={sec.key} style={styles.section}>
                <Text style={styles.sectionLabel}>{sec.label}</Text>
                {sectionItems.map(({ label, href, Icon }) => (
                  <TouchableOpacity
                    key={href}
                    style={styles.menuItem}
                    onPress={() => navigate(href)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIconWrap}>
                      <Icon size={18} color={Design.colors.text} strokeWidth={2} />
                    </View>
                    <Text style={styles.menuLabel}>{label}</Text>
                    <ChevronRight size={16} color={Design.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Design.colors.background,
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
    }),
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Design.spacing.lg,
    paddingBottom: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
  },
  drawerTitle: {
    fontSize: Design.fontSize.subtitle,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  bleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    margin: Design.spacing.md,
    padding: Design.spacing.md,
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  bleDot: { width: 10, height: 10, borderRadius: 5 },
  bleInfo: { flex: 1 },
  bleTitle: { fontSize: Design.fontSize.body, fontWeight: Design.fontWeight.semi, color: Design.colors.text },
  bleSubtitle: { fontSize: Design.fontSize.caption, color: Design.colors.textMuted },
  menuList: { flex: 1, paddingHorizontal: Design.spacing.md },
  section: { marginTop: Design.spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Design.spacing.xs,
    paddingLeft: Design.spacing.xs,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.md,
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.sm,
    borderRadius: Design.radius.md,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Design.radius.sm,
    backgroundColor: Design.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: Design.fontSize.body, color: Design.colors.text, fontWeight: Design.fontWeight.normal },
});
