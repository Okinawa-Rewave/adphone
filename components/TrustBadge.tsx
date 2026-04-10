import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Shield, CheckCircle, HelpCircle, AlertTriangle } from "lucide-react-native";
import { Design } from "@/constants/Design";
import type { TrustLevel } from "@/contexts/NotificationContext";

interface Config {
  label: string;
  color: string;
  bg: string;
  Icon: any;
}

const CONFIG: Record<TrustLevel, Config> = {
  official:   { label: "公式",     color: Design.colors.trustOfficial,   bg: Design.colors.trustOfficialMuted,   Icon: Shield },
  verified:   { label: "確認済",   color: Design.colors.trustVerified,   bg: Design.colors.trustVerifiedMuted,   Icon: CheckCircle },
  partial:    { label: "一部確認", color: Design.colors.trustPartial,    bg: Design.colors.trustPartialMuted,    Icon: HelpCircle },
  unverified: { label: "未確認",   color: Design.colors.trustUnverified, bg: Design.colors.trustUnverifiedMuted, Icon: AlertTriangle },
};

interface Props {
  level: TrustLevel;
  size?: "sm" | "md";
}

export function TrustBadge({ level, size = "md" }: Props) {
  const { label, color, bg, Icon } = CONFIG[level];
  const sm = size === "sm";
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Icon size={sm ? 10 : 12} color={color} strokeWidth={2.5} />
      <Text style={[styles.label, { color, fontSize: sm ? 11 : 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: Design.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: Design.fontWeight.semi,
  },
});
