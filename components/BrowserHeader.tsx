import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { ChevronLeft, ChevronRight, Smartphone, RotateCw, Check } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Design } from "@/constants/Design";
import { useBleConnected } from "@/hooks/useBleConnected";

// BrowserHeader インスタンス間で共有する進む履歴
const forwardStack: string[] = [];

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
  const [canGoForward, setCanGoForward] = useState(false);
  const bleConnected = useBleConnected();
  // 'back' / 'forward' の場合は進む履歴をクリアしない
  const navigatingRef = useRef<"back" | "forward" | null>(null);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: refreshing
          ? withRepeat(withTiming("360deg", { duration: 500 }), -1)
          : "0deg",
      },
    ],
  }));

  // pathname が変わったとき：通常遷移なら進む履歴をリセット
  useEffect(() => {
    if (navigatingRef.current === "back" || navigatingRef.current === "forward") {
      navigatingRef.current = null;
      return;
    }
    forwardStack.length = 0;
    setCanGoForward(false);
  }, [pathname]);

  const handleBack = () => {
    navigatingRef.current = "back";
    forwardStack.push(pathname);
    setCanGoForward(true);
    router.back();
  };

  const handleForward = () => {
    const next = forwardStack.pop();
    if (!next) return;
    navigatingRef.current = "forward";
    setCanGoForward(forwardStack.length > 0);
    router.push(next as any);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {showControls && (
          <View style={styles.controls}>
            {showBack ? (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.controlTouch}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronLeft size={20} color={Design.colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.controlPlaceholder} />
            )}

            {canGoForward ? (
              <TouchableOpacity
                onPress={handleForward}
                style={styles.controlTouch}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronRight size={20} color={Design.colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.controlTouch, styles.disabled]}>
                <ChevronRight size={20} color={Design.colors.border} />
              </View>
            )}

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

            <TouchableOpacity
              onPress={() => router.push("/settings/adphone")}
              style={styles.controlTouch}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.bleIconWrap}>
                <Smartphone
                  size={16}
                  color={bleConnected ? Design.colors.success : Design.colors.border}
                />
                <View
                  style={[
                    styles.bleDot,
                    bleConnected ? styles.bleDotOn : styles.bleDotOff,
                  ]}
                />
              </View>
            </TouchableOpacity>
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
  bleIconWrap: {
    position: "relative",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bleDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Design.colors.white,
  },
  bleDotOn: {
    backgroundColor: Design.colors.success,
  },
  bleDotOff: {
    backgroundColor: Design.colors.border,
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
