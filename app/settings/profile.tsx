import { auth, db } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

export default function SettingsScreen() {
  const [nickname, setNickname] = useState("");
  const [icon, setIcon] = useState("🙂");
  const [status, setStatus] = useState("ready");

  useEffect(() => {
    (async () => {
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser!.uid;
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const d = snap.data();
        setNickname(d.nickname ?? "");
        setIcon(d.icon ?? "🙂");
      }
    })();
  }, []);

  const saveProfile = async () => {
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const uid = auth.currentUser!.uid;
      setStatus("保存中…");
      await setDoc(
        doc(db, "users", uid),
        { nickname: nickname || "匿名", icon: icon || "🙂", updatedAt: serverTimestamp() },
        { merge: true }
      );
      setStatus("保存しました");
    } catch (e) {
      console.error("saveProfile error:", e);
      setStatus("エラー");
    }
  };

  return (
    <ScreenLayout title="設定" subtitle="プロフィール">
      <View style={styles.container}>
        <Text style={styles.label}>表示名（ニックネーム）</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="例：Kamiya"
          placeholderTextColor={Design.colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>アイコン（絵文字1つ）</Text>
        <TextInput
          value={icon}
          onChangeText={setIcon}
          placeholder="🙂"
          placeholderTextColor={Design.colors.textMuted}
          style={[styles.input, styles.inputIcon]}
        />

        <Pressable onPress={saveProfile} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>保存</Text>
        </Pressable>

        <Text style={styles.status}>{status}</Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Design.spacing.md,
  },
  label: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  inputIcon: {
    fontSize: 24,
  },
  saveButton: {
    marginTop: Design.spacing.sm,
    paddingVertical: Design.spacing.lg,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
  },
  saveButtonText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
  },
  status: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
  },
});
