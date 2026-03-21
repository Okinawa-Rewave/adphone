import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { MobileFrame } from "@/components/MobileFrame";
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";
import { Design } from "@/constants/Design";

type ScreenLayoutProps = {
  /** AppHeader タイトル */
  title: string;
  /** AppHeader サブタイトル */
  subtitle?: string;
  /** 戻るボタン（BrowserHeader + AppHeader） */
  showBack?: boolean;
  /** AppHeader 右側アクション */
  rightAction?: ReactNode;
  /** BrowserHeader 更新コールバック */
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshSuccessPulse?: boolean;
  /** ホームでは BrowserHeader の戻るを非表示 */
  showBrowserBack?: boolean;
  children: ReactNode;
  /** コンテンツのスタイル */
  contentStyle?: object;
};

/**
 * 全画面共通：1段目 BrowserHeader、2段目 AppHeader、その下にコンテンツ。
 * 角丸・余白・視認性を統一した災害時アプリ用レイアウト。
 */
export function ScreenLayout({
  title,
  subtitle,
  showBack = true,
  rightAction,
  onRefresh,
  refreshing = false,
  refreshSuccessPulse = false,
  showBrowserBack = true,
  children,
  contentStyle,
}: ScreenLayoutProps) {
  return (
    <MobileFrame>
      <BrowserHeader
        showBack={showBrowserBack}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshSuccessPulse={refreshSuccessPulse}
      />
      <AppHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        rightAction={rightAction}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
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
