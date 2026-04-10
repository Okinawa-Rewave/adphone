import { Link } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

export default function NotFoundScreen() {
  return (
    <ScreenLayout title="ページが見つかりません">
      <View style={styles.container}>
        <Text style={styles.text}>お探しのページは存在しません。</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.link} activeOpacity={0.8}>
            <Text style={styles.linkText}>ホームへ戻る</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Design.spacing.lg,
  },
  text: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textSecondary,
    textAlign: "center",
  },
  link: {
    marginTop: Design.spacing.xl,
    paddingVertical: Design.spacing.lg,
    paddingHorizontal: Design.spacing.xl,
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.md,
  },
  linkText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.white,
  },
});
