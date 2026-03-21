import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

export default function AIScreen() {
  return (
    <ScreenLayout title="AI" subtitle="準備中">
      <View style={styles.container}>
        <Text style={styles.text}>AI機能は準備中です</Text>
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
  },
});
