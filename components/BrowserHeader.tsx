import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { ChevronLeft, ChevronRight, Smartphone, RotateCw, Check } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type BrowserHeaderProps = {
  showControls?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshSuccessPulse?: boolean; // ★追加
};

export function BrowserHeader({
  showControls = true,
  onRefresh,
  refreshing = false,
  refreshSuccessPulse = false,
}: BrowserHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const spinStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: refreshing
            ? withRepeat(withTiming("360deg", { duration: 500 }), -1)
            : "0deg",
        },
      ],
    };
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {showControls && (
          <View style={styles.controls}>
            {/* 戻る */}
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={18} color="#6b7280" />
            </TouchableOpacity>

            {/* 進む（ダミー） */}
            <View style={styles.disabled}>
              <ChevronRight size={18} color="#d1d5db" />
            </View>

            {/* 更新 */}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={refreshing}
              style={{ opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshSuccessPulse ? (
                <Check size={16} color="#22c55e" />
              ) : (
                <Animated.View style={spinStyle}>
                  <RotateCw size={16} color="#6b7280" />
                </Animated.View>
              )}
            </TouchableOpacity>

            {/* デバイス（ダミー） */}
            <View style={styles.disabled}>
              <Smartphone size={14} color="#6b7280" />
            </View>
          </View>
        )}

        <View style={styles.addressBar}>
          <Text style={styles.pathText}>{pathname}</Text>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: "#f3f4f6",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 40,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  addressBar: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pathText: {
    fontSize: 13,
    color: "#374151",
  },
});
