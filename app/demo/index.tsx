import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight, Play, Shield } from "lucide-react-native";
import { AppBar } from "@/components/AppBar";
import { MobileFrame } from "@/components/MobileFrame";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustMeter } from "@/components/TrustMeter";
import { Design } from "@/constants/Design";
import type { TrustLevel } from "@/contexts/NotificationContext";

// ────────────────────────────────────────────────────────────
// Step 2 phases
// ────────────────────────────────────────────────────────────
type Sig = { name: string; label: string; isOfficial: boolean };
type Phase = { score: number; level: TrustLevel; event: string; sigs: Sig[] };

const PHASES: Phase[] = [
  {
    score: 20,
    level: "unverified",
    event: "初期状態：投稿直後",
    sigs: [],
  },
  {
    score: 29,
    level: "unverified",
    event: "市民3人が「参考になった」",
    sigs: [
      { name: "市民A", label: "一般ユーザー", isOfficial: false },
      { name: "市民B", label: "一般ユーザー", isOfficial: false },
      { name: "市民C", label: "一般ユーザー", isOfficial: false },
    ],
  },
  {
    score: 55,
    level: "partial",
    event: "渋谷消防署が署名",
    sigs: [
      { name: "市民A", label: "一般ユーザー", isOfficial: false },
      { name: "市民B", label: "一般ユーザー", isOfficial: false },
      { name: "市民C", label: "一般ユーザー", isOfficial: false },
      { name: "渋谷消防署", label: "消防団", isOfficial: true },
    ],
  },
  {
    score: 92,
    level: "official",
    event: "東京都が公式署名",
    sigs: [
      { name: "市民A", label: "一般ユーザー", isOfficial: false },
      { name: "市民B", label: "一般ユーザー", isOfficial: false },
      { name: "市民C", label: "一般ユーザー", isOfficial: false },
      { name: "渋谷消防署", label: "消防団", isOfficial: true },
      { name: "東京都", label: "行政機関", isOfficial: true },
    ],
  },
];

// ────────────────────────────────────────────────────────────
// Step 1: コントラスト
// ────────────────────────────────────────────────────────────
function ContrastStep() {
  return (
    <ScrollView contentContainerStyle={s1.container} showsVerticalScrollIndicator={false}>
      <Text style={s1.heading}>同じ情報なのに、なぜ差がある？</Text>
      <Text style={s1.sub}>信頼度バッジとメーターで、一目で判断できます</Text>

      <View style={[s1.card, { borderColor: Design.colors.trustUnverified }]}>
        <View style={s1.cardHeader}>
          <TrustBadge level="unverified" />
          <Text style={s1.author}>匿名ユーザー</Text>
        </View>
        <Text style={s1.cardText}>
          △△川付近で浸水を確認。道路が冠水しています。
        </Text>
        <TrustMeter score={20} level="unverified" />
        <Text style={s1.sigNote}>署名なし・目撃確認なし</Text>
      </View>

      <View style={s1.divider}>
        <View style={s1.dividerLine} />
        <Text style={s1.dividerText}>同じ場所・同じ災害</Text>
        <View style={s1.dividerLine} />
      </View>

      <View style={[s1.card, { borderColor: Design.colors.trustOfficial }]}>
        <View style={s1.cardHeader}>
          <TrustBadge level="official" />
          <Text style={s1.author}>気象庁</Text>
        </View>
        <Text style={s1.cardText}>
          △△川付近で浸水を確認。周辺住民は速やかに避難してください。
        </Text>
        <TrustMeter score={92} level="official" />
        <View style={s1.sigRow}>
          <Shield size={12} color={Design.colors.trustOfficial} strokeWidth={2} />
          <Text style={s1.sigText}>気象庁 · 渋谷消防署が署名</Text>
        </View>
      </View>

      <Text style={s1.caption}>
        色・バッジ・スコアの3要素で即座に判断可能
      </Text>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Step 2: 信頼度が育つアニメーション
// ────────────────────────────────────────────────────────────
function AnimationStep() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = PHASES[phaseIdx];

  const playSequence = () => {
    setPhaseIdx(0);
    setPlaying(true);
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
    setPhaseIdx(0);
  };

  useEffect(() => {
    if (!playing) return;
    if (phaseIdx >= PHASES.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setPhaseIdx((i) => i + 1), 1800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, phaseIdx]);

  return (
    <ScrollView contentContainerStyle={s2.container} showsVerticalScrollIndicator={false}>
      <Text style={s2.heading}>信頼度は積み上がる</Text>
      <Text style={s2.sub}>市民の投票 → 専門機関の署名 → 公式認定</Text>

      <View style={s2.phaseRow}>
        {PHASES.map((_, i) => (
          <View key={i} style={[s2.phaseDot, i <= phaseIdx && s2.phaseDotActive]} />
        ))}
      </View>

      <View style={s2.card}>
        <View style={s2.cardHeader}>
          <TrustBadge level={phase.level} />
          <View style={[s2.eventTag, { backgroundColor: Design.colors.surfaceElevated }]}>
            <Text style={s2.eventText}>{phase.event}</Text>
          </View>
        </View>
        <Text style={s2.cardText}>
          △△川付近で浸水を確認。道路が冠水しています。
        </Text>
        <TrustMeter score={phase.score} level={phase.level} animated />

        <View style={s2.sigList}>
          {phase.sigs.length === 0 ? (
            <Text style={s2.noSig}>署名なし</Text>
          ) : (
            phase.sigs.map((sig, i) => (
              <View key={i} style={s2.sigRow}>
                <View
                  style={[
                    s2.sigDot,
                    { backgroundColor: sig.isOfficial ? Design.colors.trustOfficial : Design.colors.border },
                  ]}
                />
                <Text style={[s2.sigName, sig.isOfficial && s2.sigOfficial]}>
                  {sig.name}
                </Text>
                <Text style={s2.sigLabel}>{sig.label}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={s2.controls}>
        <TouchableOpacity
          style={[s2.playBtn, playing && s2.playBtnDisabled]}
          onPress={playSequence}
          disabled={playing}
          activeOpacity={0.7}
        >
          <Play size={15} color={Design.colors.white} strokeWidth={2.5} fill={Design.colors.white} />
          <Text style={s2.playBtnText}>{playing ? "再生中..." : "再生する"}</Text>
        </TouchableOpacity>
        {phaseIdx > 0 && !playing && (
          <TouchableOpacity style={s2.resetBtn} onPress={reset} activeOpacity={0.7}>
            <Text style={s2.resetText}>リセット</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Step 3: 地図集約（模式図）
// ────────────────────────────────────────────────────────────
function ScaleStep() {
  return (
    <ScrollView contentContainerStyle={s3.container} showsVerticalScrollIndicator={false}>
      <Text style={s3.heading}>地図でリアルタイムに集約</Text>
      <Text style={s3.sub}>個人の目撃情報が積み重なり、信頼できるマップへ</Text>

      <View style={s3.mapBox}>
        {/* ★★★ クラスター */}
        <View style={[s3.bubble, s3.bubbleHigh, { top: 24, left: 20 }]}>
          <Text style={s3.starsHigh}>★★★</Text>
          <Text style={s3.bubbleCount}>7人目撃</Text>
          <View style={s3.officialRow}>
            <Shield size={9} color={Design.colors.trustOfficial} strokeWidth={2} />
            <Text style={s3.officialText}>公式2機関</Text>
          </View>
        </View>

        {/* ★ 単独報告 */}
        <View style={[s3.bubble, s3.bubbleLow, { top: 100, right: 24 }]}>
          <Text style={s3.starsLow}>★</Text>
          <Text style={s3.bubbleCount}>1人報告</Text>
          <Text style={s3.unverifiedText}>未確認</Text>
        </View>

        {/* 装飾グリッド */}
        <View style={s3.gridH} />
        <View style={s3.gridV} />
        <Text style={s3.mapWatermark}>現在地周辺</Text>
      </View>

      <View style={s3.legend}>
        <View style={s3.legendRow}>
          <View style={[s3.legendDot, { backgroundColor: Design.colors.trustOfficial }]} />
          <Text style={s3.legendText}>★★★　複数目撃 + 公式機関が確認</Text>
        </View>
        <View style={s3.legendRow}>
          <View style={[s3.legendDot, { backgroundColor: Design.colors.trustUnverified }]} />
          <Text style={s3.legendText}>★　　 単独報告・未確認</Text>
        </View>
      </View>

      <Text style={s3.caption}>
        個人 → 群衆 → 公式機関の信頼が重なるほど★が増え、
        危険エリアが地図上に浮かび上がります
      </Text>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
const STEP_LABELS = ["コントラスト", "変化", "集約"];

export default function DemoScreen() {
  const [step, setStep] = useState(0);

  return (
    <MobileFrame>
      <AppBar
        title="信頼度デモ"
        subtitle={`Step ${step + 1} / ${STEP_LABELS.length}  ${STEP_LABELS[step]}`}
        showBack
      />

      <View style={styles.content}>
        {step === 0 && <ContrastStep />}
        {step === 1 && <AnimationStep />}
        {step === 2 && <ScaleStep />}
      </View>

      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.navBtn, step === 0 && styles.navBtnDisabled]}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          activeOpacity={0.7}
        >
          <ChevronLeft
            size={20}
            color={step === 0 ? Design.colors.textMuted : Design.colors.primary}
            strokeWidth={2.5}
          />
          <Text style={[styles.navText, step === 0 && styles.navTextMuted]}>前へ</Text>
        </TouchableOpacity>

        <View style={styles.dots}>
          {STEP_LABELS.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setStep(i)} activeOpacity={0.7}>
              <View style={[styles.dot, i === step && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.navBtn, step === STEP_LABELS.length - 1 && styles.navBtnDisabled]}
          onPress={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))}
          disabled={step === STEP_LABELS.length - 1}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.navText,
              step === STEP_LABELS.length - 1 && styles.navTextMuted,
            ]}
          >
            次へ
          </Text>
          <ChevronRight
            size={20}
            color={
              step === STEP_LABELS.length - 1
                ? Design.colors.textMuted
                : Design.colors.primary
            }
            strokeWidth={2.5}
          />
        </TouchableOpacity>
      </View>
    </MobileFrame>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { flex: 1, backgroundColor: Design.colors.background },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  navBtnDisabled: { opacity: 0.3 },
  navText: { fontSize: Design.fontSize.caption, fontWeight: Design.fontWeight.semi, color: Design.colors.primary },
  navTextMuted: { color: Design.colors.textMuted },
  dots: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Design.colors.border },
  dotActive: { backgroundColor: Design.colors.primary, width: 20, borderRadius: 4 },
});

// Step 1
const s1 = StyleSheet.create({
  container: { padding: Design.spacing.lg, gap: Design.spacing.md },
  heading: {
    fontSize: Design.fontSize.subtitle,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  sub: { fontSize: Design.fontSize.caption, color: Design.colors.textMuted },
  card: {
    borderWidth: 1.5,
    borderRadius: Design.radius.md,
    padding: Design.spacing.md,
    gap: Design.spacing.sm,
    backgroundColor: Design.colors.background,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { fontSize: 12, color: Design.colors.textMuted, fontWeight: Design.fontWeight.semi },
  cardText: { fontSize: Design.fontSize.caption, color: Design.colors.text, lineHeight: 20 },
  divider: { flexDirection: "row", alignItems: "center", gap: Design.spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Design.colors.border },
  dividerText: { fontSize: 12, color: Design.colors.textMuted },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sigText: { fontSize: 12, color: Design.colors.trustOfficial, fontWeight: Design.fontWeight.semi },
  sigNote: { fontSize: 11, color: Design.colors.textMuted },
  caption: {
    fontSize: 12,
    color: Design.colors.textMuted,
    textAlign: "center",
    paddingVertical: Design.spacing.xs,
  },
});

// Step 2
const s2 = StyleSheet.create({
  container: { padding: Design.spacing.lg, gap: Design.spacing.md },
  heading: {
    fontSize: Design.fontSize.subtitle,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  sub: { fontSize: Design.fontSize.caption, color: Design.colors.textMuted },
  phaseRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  phaseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Design.colors.border },
  phaseDotActive: { backgroundColor: Design.colors.primary },
  card: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    padding: Design.spacing.md,
    gap: Design.spacing.sm,
    backgroundColor: Design.colors.background,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Design.spacing.sm, flexWrap: "wrap" },
  eventTag: { borderRadius: Design.radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  eventText: { fontSize: 11, color: Design.colors.textSecondary, fontWeight: Design.fontWeight.semi },
  cardText: { fontSize: Design.fontSize.caption, color: Design.colors.text, lineHeight: 20 },
  sigList: { gap: 6, marginTop: 4 },
  noSig: { fontSize: 12, color: Design.colors.textMuted, fontStyle: "italic" },
  sigRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sigDot: { width: 8, height: 8, borderRadius: 4 },
  sigName: { fontSize: 12, fontWeight: Design.fontWeight.semi, color: Design.colors.text, flex: 1 },
  sigOfficial: { color: Design.colors.trustOfficial },
  sigLabel: { fontSize: 11, color: Design.colors.textMuted },
  controls: { flexDirection: "row", alignItems: "center", gap: Design.spacing.sm, justifyContent: "center" },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.full,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.sm,
  },
  playBtnDisabled: { opacity: 0.5 },
  playBtnText: { fontSize: Design.fontSize.caption, fontWeight: Design.fontWeight.bold, color: Design.colors.white },
  resetBtn: {
    borderRadius: Design.radius.full,
    borderWidth: 1,
    borderColor: Design.colors.border,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  resetText: { fontSize: Design.fontSize.caption, color: Design.colors.textSecondary },
});

// Step 3
const s3 = StyleSheet.create({
  container: { padding: Design.spacing.lg, gap: Design.spacing.md },
  heading: {
    fontSize: Design.fontSize.subtitle,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  sub: { fontSize: Design.fontSize.caption, color: Design.colors.textMuted },
  mapBox: {
    height: 200,
    borderRadius: Design.radius.lg,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  bubble: {
    position: "absolute",
    borderRadius: Design.radius.md,
    padding: Design.spacing.sm,
    gap: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleHigh: {
    backgroundColor: Design.colors.background,
    borderWidth: 2,
    borderColor: Design.colors.trustOfficial,
    minWidth: 110,
  },
  bubbleLow: {
    backgroundColor: Design.colors.background,
    borderWidth: 1.5,
    borderColor: Design.colors.trustUnverified,
    minWidth: 90,
  },
  starsHigh: { fontSize: 14, color: Design.colors.trustOfficial, fontWeight: Design.fontWeight.bold },
  starsLow: { fontSize: 13, color: Design.colors.trustUnverified, fontWeight: Design.fontWeight.bold },
  bubbleCount: { fontSize: 11, fontWeight: Design.fontWeight.semi, color: Design.colors.text },
  officialRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  officialText: { fontSize: 10, color: Design.colors.trustOfficial, fontWeight: Design.fontWeight.semi },
  unverifiedText: { fontSize: 10, color: Design.colors.trustUnverified },
  gridH: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  mapWatermark: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: "rgba(0,0,0,0.3)",
  },
  legend: { gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: Design.colors.textSecondary, fontFamily: "SpaceMono" },
  caption: {
    fontSize: 12,
    color: Design.colors.textMuted,
    lineHeight: 18,
    textAlign: "center",
  },
});
