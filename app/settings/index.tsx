import { Link } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Design } from "@/constants/Design";

export default function SettingsIndexScreen() {
  return (
    <ScreenLayout title="設定" subtitle="項目一覧" showBack={false} showBottomTab>
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>設定項目</Text>

        <Link href="/settings/profile" asChild>
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle}>プロフィール</Text>
              <Text style={styles.itemDesc}>表示名・アイコンを変更します</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/disaster/emergency-contacts" asChild>
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle}>緊急連絡先</Text>
              <Text style={styles.itemDesc}>災害時に連絡する先を管理</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/settings/adphone" asChild>
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle}>アドフォン連携</Text>
              <Text style={styles.itemDesc}>Bluetooth / LoRa ノード接続（準備中）</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Link>

        <Text style={[styles.sectionTitle, { marginTop: Design.spacing.md }]}>開発・デモ</Text>

        <Link href={"/demo" as any} asChild>
          <TouchableOpacity style={[styles.item, styles.demoItem]} activeOpacity={0.7}>
            <View style={styles.itemLeft}>
              <Text style={[styles.itemTitle, styles.demoTitle]}>信頼度デモモード</Text>
              <Text style={styles.itemDesc}>信頼度の仕組みをステップ形式で確認</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Design.spacing.md,
  },
  sectionTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textSecondary,
    marginBottom: Design.spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.lg,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  itemLeft: {
    flex: 1,
    paddingRight: Design.spacing.md,
  },
  itemTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  itemDesc: {
    marginTop: Design.spacing.xs,
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: Design.colors.textMuted,
    marginLeft: Design.spacing.sm,
  },
  demoItem: {
    borderColor: Design.colors.primary,
    backgroundColor: Design.colors.primaryMuted,
  },
  demoTitle: {
    color: Design.colors.primary,
  },
});
