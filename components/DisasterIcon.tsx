import React from "react";
import { View, StyleSheet } from "react-native";
import { AlertTriangle, Droplets, Flame, Building2, Mountain, HelpCircle } from "lucide-react-native";
import { Design } from "@/constants/Design";
import type { DisasterType } from "@/contexts/NotificationContext";

interface Config { Icon: any; color: string; bg: string }

const CONFIG: Record<DisasterType, Config> = {
  earthquake: { Icon: AlertTriangle, color: Design.colors.disasterEarthquake, bg: "#fff7ed" },
  flood:      { Icon: Droplets,      color: Design.colors.disasterFlood,      bg: "#eff6ff" },
  fire:       { Icon: Flame,         color: Design.colors.disasterFire,       bg: "#fef2f2" },
  collapse:   { Icon: Building2,     color: Design.colors.disasterCollapse,   bg: "#f5f5f4" },
  landslide:  { Icon: Mountain,      color: Design.colors.disasterLandslide,  bg: "#fffbeb" },
  other:      { Icon: HelpCircle,    color: Design.colors.disasterOther,      bg: Design.colors.surfaceElevated },
};

const SIZES = { sm: 18, md: 22, lg: 28 };
const PAD   = { sm: 8,  md: 10, lg: 12 };
const RAD   = { sm: Design.radius.sm, md: Design.radius.md, lg: Design.radius.lg };

interface Props {
  type: DisasterType;
  size?: "sm" | "md" | "lg";
}

export function DisasterIcon({ type, size = "md" }: Props) {
  const { Icon, color, bg } = CONFIG[type];
  return (
    <View style={[styles.wrap, { backgroundColor: bg, padding: PAD[size], borderRadius: RAD[size] }]}>
      <Icon size={SIZES[size]} color={color} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
});
