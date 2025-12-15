import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppHeaderProps = {
  /** メインタイトル */
  title: string;

  /** サブタイトル（任意） */
  subtitle?: string;

  /** 戻るボタンを表示するか */
  showBack?: boolean;

  /** 右側に配置するアクション */
  rightAction?: React.ReactNode;

  /** 高さを変えたい場合（タブレットなど） */
  height?: number;
};

export function AppHeader({
  title,
  subtitle,
  showBack = true,
  rightAction,
  height = 56,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingTop: insets.top,
          height: height + insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        {/* 左：戻る */}
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowLeft size={20} color="#111827" />
              <Text style={styles.backText}>戻る</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 中央：タイトル */}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* 右：アクション */}
        <View style={styles.right}>{rightAction}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  left: {
    width: 80,
    justifyContent: "center",
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#4b5563",
  },

  center: {
    flex: 1,
    alignItems: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
  },

  right: {
    width: 80,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
