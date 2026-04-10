import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Design } from "@/constants/Design";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  /** 2段ヘッダー時は false（BrowserHeader 下）。standalone 時は true */
  noTopInset?: boolean;
  height?: number;
};

export function AppHeader({
  title,
  subtitle,
  showBack = true,
  rightAction,
  noTopInset = true,
  height = 60,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.wrapper, { minHeight: height }]}>
      <View style={styles.header}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={22} color={Design.colors.text} />
              <Text style={styles.backText}>戻る</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>{rightAction}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Design.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.sm,
  },
  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  left: {
    minWidth: 88,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Design.spacing.xs,
    paddingRight: Design.spacing.xs,
  },
  backText: {
    marginLeft: Design.spacing.xs,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: Design.fontSize.body,
    color: Design.colors.textSecondary,
  },
  right: {
    minWidth: 88,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
