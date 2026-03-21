import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { ChevronLeft, ChevronRight, Smartphone, RotateCw, Check } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Design } from "@/constants/Design";

type BrowserHeaderProps = {
  showControls?: boolean;
  /** 戻るを表示するか（ホームでは false） */
  showBack?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshSuccessPulse?: boolean;
};

export function BrowserHeader({
  showControls = true,
  showBack = true,
  onRefresh,
  refreshing = false,
  refreshSuccessPulse = false,
}: BrowserHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const spinStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: refreshing
          ? withRepeat(withTiming("360deg", { duration: 500 }), -1)
          : "0deg",
      },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {showControls && (
          <View style={styles.controls}>
            {showBack ? (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.controlTouch}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronLeft size={20} color={Design.colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.controlPlaceholder} />
            )}
            <View style={styles.disabled}>
              <ChevronRight size={20} color={Design.colors.border} />
            </View>
            <TouchableOpacity
              onPress={onRefresh}
              disabled={refreshing}
              style={[styles.controlTouch, refreshing && { opacity: 0.6 }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {refreshSuccessPulse ? (
                <Check size={18} color={Design.colors.success} />
              ) : (
                <Animated.View style={spinStyle}>
                  <RotateCw size={18} color={Design.colors.textSecondary} />
                </Animated.View>
              )}
            </TouchableOpacity>
            <View style={styles.disabled}>
              <Smartphone size={16} color={Design.colors.border} />
            </View>
          </View>
        )}
        <View style={styles.addressBar}>
          <Text style={styles.pathText} numberOfLines={1}>
            {pathname || "/"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: Design.spacing.xs,
    paddingHorizontal: Design.spacing.sm,
    paddingBottom: Design.spacing.xs,
    backgroundColor: Design.colors.surface,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Design.colors.white,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.sm,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    marginRight: Design.spacing.sm,
  },
  controlTouch: {
    padding: Design.spacing.xs,
  },
  controlPlaceholder: {
    width: 20,
    height: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  addressBar: {
    flex: 1,
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.sm,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  pathText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
  },
});
