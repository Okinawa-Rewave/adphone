/**
 * ChatTabSwitch — 地域チャット / 個人 の2タブ切り替えUI
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Globe, User } from "lucide-react-native";
import { Design } from "@/constants/Design";

export type ChatTab = "regional" | "direct";

interface Props {
  activeTab: ChatTab;
  onChange: (tab: ChatTab) => void;
  onlineCount?: number; // 地域チャットのオンライン人数
}

export function ChatTabSwitch({ activeTab, onChange, onlineCount }: Props) {
  const tabs: { key: ChatTab; label: string; Icon: any }[] = [
    { key: "regional", label: "地域チャット", Icon: Globe },
    { key: "direct",   label: "個人",         Icon: User  },
  ];

  return (
    <View style={styles.wrap}>
      {tabs.map(({ key, label, Icon }) => {
        const active = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(key)}
            activeOpacity={0.75}
          >
            <View style={styles.tabInner}>
              <Icon
                size={15}
                color={active ? Design.colors.primary : Design.colors.textMuted}
                strokeWidth={active ? 2.3 : 1.8}
              />
              <Text style={[styles.label, active && styles.labelActive]}>
                {label}
              </Text>
              {/* 地域タブ：オンラインパルスドット */}
              {key === "regional" && (
                <View style={[
                  styles.dot,
                  { backgroundColor: active ? Design.colors.trustVerified : Design.colors.textMuted },
                ]} />
              )}
              {/* 地域タブ：オンライン人数 */}
              {key === "regional" && onlineCount != null && onlineCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{onlineCount}</Text>
                </View>
              )}
            </View>
            {active && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: Design.spacing.sm,
  },
  tabActive: {},
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingBottom: Design.spacing.sm,
  },
  label: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },
  labelActive: {
    color: Design.colors.primary,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  countBadge: {
    backgroundColor: Design.colors.trustVerifiedMuted,
    borderRadius: Design.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    fontSize: 10,
    color: Design.colors.trustVerified,
    fontWeight: Design.fontWeight.bold,
  },
  underline: {
    height: 2,
    width: "60%",
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.full,
  },
});
