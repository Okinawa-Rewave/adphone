// app/settings/profile.tsx — プロフィール設定画面
import { auth, db } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { TrustMeter } from "@/components/TrustMeter";
import { TrustBadge } from "@/components/TrustBadge";
import type { TrustLevel } from "@/contexts/NotificationContext";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

function scoreToLevel(s: number): TrustLevel {
  if (s >= 80) return "verified";
  if (s >= 50) return "partial";
  return "unverified";
}

// ─── アバター背景色（UIDのcharCode合計 % 360 をhueとしたHSL） ───────────
function uidToAvatarColor(uid: string): string {
  const hue = [...uid].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 60%)`;
}

export default function ProfileScreen() {
  const [uid, setUid] = useState("");
  const [userTrustScore, setUserTrustScore] = useState(50);

  // ── 表示名 ──
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");

  // ── 電話番号 ──
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");

  // ── 居住エリア ──
  const [area, setArea] = useState("");
  const [savedArea, setSavedArea] = useState("");

  // ── 保存ステート ──
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  // 変更があるかどうか
  const isDirty =
    nickname !== savedNickname ||
    phone !== savedPhone ||
    area !== savedArea;

  // ── 初期ロード（プロフィール項目は一度だけ取得） ──
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) await signInAnonymously(auth);
      const myUid = auth.currentUser!.uid;
      setUid(myUid);

      const snap = await getDoc(doc(db, "users", myUid));
      if (snap.exists()) {
        const d = snap.data();
        const n = d.nickname ?? "";
        const p = d.phone ?? "";
        const a = d.area ?? "";
        setNickname(n);
        setSavedNickname(n);
        setPhone(p);
        setSavedPhone(p);
        setArea(a);
        setSavedArea(a);
        setUserTrustScore(d.userTrustScore ?? 50);
      }
    })();
  }, []);

  // ── userTrustScore をリアルタイム監視 ──
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        setUserTrustScore(snap.data().userTrustScore ?? 50);
      }
    });
    return unsub;
  }, [uid]);

  // ── 保存処理 ──
  const saveProfile = async () => {
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const myUid = auth.currentUser!.uid;
      setSaveState("saving");

      await setDoc(
        doc(db, "users", myUid),
        {
          nickname: nickname || "匿名",
          phone,
          area,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 保存済み値を同期
      setSavedNickname(nickname);
      setSavedPhone(phone);
      setSavedArea(area);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      console.error("saveProfile error:", e);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  };

  // ── アバター表示 ──
  const avatarColor = uid ? uidToAvatarColor(uid) : "hsl(220, 55%, 60%)";
  const avatarInitial = nickname.trim().slice(0, 1) || "?";

  // ── 保存ボタンラベル ──
  const saveBtnLabel =
    saveState === "saving" ? "保存中..." :
    saveState === "done"   ? "✓ 保存しました" :
    "保存する";

  return (
    <ScreenLayout title="設定" subtitle="プロフィール">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ① アバターセクション */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
            <Text style={styles.avatarName}>{nickname || "名前未設定"}</Text>
            <Text style={styles.avatarSub}>Adphoneユーザー</Text>
          </View>

          {/* ② プロフィール編集カード */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>プロフィール</Text>

            {/* 表示名 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>表示名</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="名前を入力"
                placeholderTextColor={Design.colors.textMuted}
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.divider} />

            {/* 電話番号 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>電話番号</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="090-0000-0000"
                placeholderTextColor={Design.colors.textMuted}
                keyboardType="phone-pad"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.divider} />

            {/* 居住エリア */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>エリア</Text>
              <TextInput
                value={area}
                onChangeText={setArea}
                placeholder="例：那覇市"
                placeholderTextColor={Design.colors.textMuted}
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.divider} />

            {/* 信頼度スコア */}
            <View style={styles.fieldRow}>
              <View style={styles.trustLabelRow}>
                <Text style={styles.fieldLabel}>信頼度スコア</Text>
                <TrustBadge level={scoreToLevel(userTrustScore)} size="sm" />
              </View>
              <TrustMeter score={userTrustScore} level={scoreToLevel(userTrustScore)} />
            </View>
          </View>

          {/* ③ 保存ボタン */}
          <Pressable
            onPress={saveProfile}
            disabled={!isDirty || saveState === "saving"}
            style={[
              styles.saveButton,
              (!isDirty || saveState === "saving") && styles.saveButtonDisabled,
              saveState === "done" && styles.saveButtonDone,
            ]}
          >
            <Text
              style={[
                styles.saveButtonText,
                (!isDirty || saveState === "saving") && styles.saveButtonTextDisabled,
              ]}
            >
              {saveBtnLabel}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Design.spacing.md,
    gap: Design.spacing.lg,
    paddingBottom: 40,
  },

  // ── アバター ──────────────────────────────────────
  avatarSection: {
    alignItems: "center",
    gap: Design.spacing.xs,
    paddingVertical: Design.spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Design.radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Design.spacing.xs,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.white,
  },
  avatarName: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  avatarSub: {
    fontSize: 13,
    color: Design.colors.textMuted,
  },

  // ── カード ────────────────────────────────────────
  card: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    padding: Design.spacing.lg,
  },
  cardTitle: {
    fontSize: 11,
    color: Design.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: Design.fontWeight.bold,
    marginBottom: Design.spacing.sm,
  },

  // ── フィールド行 ───────────────────────────────────
  fieldRow: {
    paddingVertical: Design.spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    color: Design.colors.textMuted,
    marginBottom: 4,
  },
  trustLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 0,
    paddingHorizontal: 0,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Design.colors.border,
  },

  // ── 保存ボタン ─────────────────────────────────────
  saveButton: {
    paddingVertical: Design.spacing.lg,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: Design.colors.border,
  },
  saveButtonDone: {
    backgroundColor: Design.colors.success,
  },
  saveButtonText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
  },
  saveButtonTextDisabled: {
    color: Design.colors.textMuted,
  },
});
