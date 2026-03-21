import React, { ReactNode } from "react";
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from "react-native";
import { Link } from "expo-router";
import { Design } from "@/constants/Design";

export type NavButtonProps = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  containerStyle?: ViewStyle | ViewStyle[];
};

export function NavButton({ href, icon, label, badge }: NavButtonProps) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity style={styles.button} activeOpacity={0.7}>
        <View style={styles.iconWrapper}>
          {icon}
          {badge != null && badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "48%",
    aspectRatio: 1,
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    justifyContent: "center",
    alignItems: "center",
    padding: Design.spacing.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  iconWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    marginTop: Design.spacing.sm,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: Design.colors.danger,
    borderRadius: Design.radius.sm,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Design.spacing.sm,
  },
  badgeText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
});
