// app/settings.tsx
import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { MobileFrame } from "@/components/MobileFrame";
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";

export default function SettingsScreen() {
  const [nickname, setNickname] = useState("");
  const [icon, setIcon] = useState("🙂");
  const [status, setStatus] = useState("ready");

  // 初回：匿名ログイン＋既存プロフィール読込
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
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
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const uid = auth.currentUser!.uid;

      setStatus("saving...");
      await setDoc(
        doc(db, "users", uid),
        {
          nickname: nickname || "匿名",
          icon: icon || "🙂",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus("saved");
    } catch (e) {
      console.error("saveProfile error:", e);
      setStatus("error");
    }
  };


  return (
    <MobileFrame>
      <BrowserHeader />
      <AppHeader title="設定" subtitle="プロフィール" />

      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ fontWeight: "700" }}>表示名（ニックネーム）</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="例：Kamiya"
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 10,
          }}
        />

        <Text style={{ fontWeight: "700" }}>アイコン（絵文字1つ）</Text>
        <TextInput
          value={icon}
          onChangeText={setIcon}
          placeholder="🙂"
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 10,
            fontSize: 24,
          }}
        />

        <Pressable
          onPress={saveProfile}
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#2563eb",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>
            保存
          </Text>
        </Pressable>

        <Text style={{ color: "#6b7280" }}>{status}</Text>
      </View>
    </MobileFrame>
  );
}
