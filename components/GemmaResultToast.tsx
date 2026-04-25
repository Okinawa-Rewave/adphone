import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle, X } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { LEVEL_CONFIG } from "@/constants/BuildingDamage";
import { useUI } from "@/contexts/UIContext";

const TOAST_DURATION = 5000;
const SLIDE_DURATION = 300;

export function GemmaResultToast() {
  const { gemmaResult, dismissGemmaResult } = useUI();
  const translateY = useRef(new Animated.Value(120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gemmaResult) {
      // スライドイン
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }).start();

      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, TOAST_DURATION);
    } else {
      translateY.setValue(120);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gemmaResult]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: 120,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => dismissGemmaResult());
  };

  if (!gemmaResult) return null;

  const levelKey = gemmaResult.damageLevel;
  const levelCfg =
    levelKey && levelKey !== "manual" ? LEVEL_CONFIG[levelKey] : null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <CheckCircle size={16} color={Design.colors.success} strokeWidth={2.5} />
        <Text style={styles.headerText}>投稿しました</Text>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={Design.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {levelCfg && (
          <View style={[styles.badge, { backgroundColor: levelCfg.bg, borderColor: levelCfg.color }]}>
            <Text style={[styles.badgeText, { color: levelCfg.color }]}>
              {levelKey}　{levelCfg.label}
            </Text>
          </View>
        )}
        {gemmaResult.content ? (
          <Text style={styles.content} numberOfLines={2}>
            {gemmaResult.content}
          </Text>
        ) : null}
        {!levelCfg && (
          <Text style={styles.manualNote}>AI 判定に失敗しました（手動設定が反映されています）</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    left: Design.spacing.md,
    right: Design.spacing.md,
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    padding: Design.spacing.md,
    gap: Design.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.xs,
  },
  headerText: {
    flex: 1,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  body: {
    gap: Design.spacing.xs,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 4,
    borderRadius: Design.radius.md,
    borderWidth: 2,
  },
  badgeText: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
  content: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textSecondary,
    lineHeight: 18,
  },
  manualNote: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
});
