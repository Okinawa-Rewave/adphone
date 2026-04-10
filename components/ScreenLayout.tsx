import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { MobileFrame } from "@/components/MobileFrame";
import { AppBar } from "@/components/AppBar";
import { BottomTab, BOTTOM_TAB_HEIGHT } from "@/components/BottomTab";
import { Design } from "@/constants/Design";

type ScreenLayoutProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
  children: ReactNode;
  contentStyle?: object;
  /** タブ画面はボトムタブを表示する */
  showBottomTab?: boolean;
};

export function ScreenLayout({
  title,
  subtitle,
  showBack = true,
  rightAction,
  children,
  contentStyle,
  showBottomTab = false,
}: ScreenLayoutProps) {
  return (
    <MobileFrame>
      <AppBar
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        rightAction={rightAction}
      />
      <View
        style={[
          styles.content,
          showBottomTab && { paddingBottom: BOTTOM_TAB_HEIGHT + 16 },
          contentStyle,
        ]}
      >
        {children}
      </View>
      {showBottomTab && <BottomTab />}
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: Design.colors.background,
    paddingHorizontal: Design.spacing.lg,
    paddingTop: Design.spacing.lg,
  },
});
