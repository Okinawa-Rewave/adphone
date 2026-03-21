// MobileFrame.tsx
import React, { ReactNode } from "react";
import { View, ViewStyle, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Design } from "@/constants/Design";

const { width } = Dimensions.get("window");

type MobileFrameProps = {
  children: ReactNode;
  isOnline?: boolean;
  style?: ViewStyle;
};

export function MobileFrame({ children, style }: MobileFrameProps) {
  const containerWidth = width > 600 ? 600 : width;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={["top", "bottom"]}>
      <View
        style={[
          styles.frame,
          { width: containerWidth, paddingBottom: Math.max(insets.bottom, Design.spacing.lg) },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Design.colors.background,
  },
  frame: {
    flex: 1,
  },
});
