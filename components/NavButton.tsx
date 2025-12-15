// components/NavButton.tsx
import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { ReactNode } from "react";
import { ViewStyle } from "react-native";

export type NavButtonProps = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  containerStyle?: ViewStyle | ViewStyle[];
};

export function NavButton({ href, icon, label, badge }: any) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={styles.button}>
        <View style={styles.iconWrapper}>
          {icon}

          {/* バッジ */}
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>

        {/* ラベル（アイコンの真下） */}
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "48%",
    aspectRatio: 1, // 正方形にして綺麗に配置
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },

  iconWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  label: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },

  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "red",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
});
