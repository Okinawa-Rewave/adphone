// app/chat/[roomId].tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ensureAnonAuth } from "@/lib/auth";
import { useOnline } from "@/hooks/useOnline";

import { MobileFrame } from "@/components/MobileFrame";
import { AppHeader } from "@/components/AppHeader";
import { BrowserHeader } from "@/components/BrowserHeader";

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderIcon?: string;
  createdAt?: any;
};

type Profile = {
  nickname: string;
  icon: string;
};

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { isOnline } = useOnline();

  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState<Profile>({
    nickname: "匿名",
    icon: "🙂",
  });

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const unsubRef = useRef<null | (() => void)>(null);

  // ===== 認証 + プロフィール取得 =====
  useEffect(() => {
    (async () => {
      const u = await ensureAnonAuth();
      const myUid = u?.uid ?? "";
      setUid(myUid);

      if (myUid) {
        const snap = await getDoc(doc(db, "users", myUid));
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            nickname: d.nickname ?? "匿名",
            icon: d.icon ?? "🙂",
          });
        }
      }
    })();
  }, []);

  // ===== Firestore購読 =====
  useEffect(() => {
    if (!roomId || !isOnline) {
      unsubRef.current?.();
      unsubRef.current = null;
      return;
    }

    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          text: data.text ?? "",
          senderId: data.senderId ?? "",
          senderName: data.senderName,
          senderIcon: data.senderIcon,
          createdAt: data.createdAt,
        };
      });
      setMessages(items);
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [roomId, isOnline]);

  // ===== 送信 =====
  const onSend = async () => {
    const text = input.trim();
    if (!text || !roomId || !isOnline) return;

    const senderId = auth.currentUser?.uid ?? uid ?? "unknown";

    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text,
      senderId,
      senderName: profile.nickname,
      senderIcon: profile.icon,
      createdAt: serverTimestamp(),
    });

    setInput("");
  };

  const headerText = useMemo(
    () => (roomId ? `shelter: ${roomId}` : "chat"),
    [roomId]
  );

  return (
    <MobileFrame isOnline={isOnline}>
      <BrowserHeader />
      <AppHeader
        title="ルームチャット"
        subtitle={`${isOnline ? "ONLINE" : "OFFLINE"} • ${headerText}`}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, padding: 12 }}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            inverted
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const myUid = auth.currentUser?.uid ?? uid;
              const mine = item.senderId === myUid;

              return (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    marginVertical: 6,
                  }}
                >
                  {!mine && (
                    <View style={{ marginRight: 6, alignItems: "center" }}>
                      <Text style={{ fontSize: 22 }}>
                        {item.senderIcon ?? "🙂"}
                      </Text>
                    </View>
                  )}

                  <View style={{ maxWidth: "75%" }}>
                    {!mine && (
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 2,
                        }}
                      >
                        {item.senderName ?? "匿名"}
                      </Text>
                    )}

                    <View
                      style={{
                        backgroundColor: mine ? "#2563eb" : "#111827",
                        padding: 10,
                        borderRadius: 14,
                      }}
                    >
                      <Text style={{ color: "#e5e7eb" }}>{item.text}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* 入力 */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="メッセージ"
              placeholderTextColor="#6b7280"
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "#374151",
                borderRadius: 12,
                padding: 10,
                color: "#e5e7eb",
              }}
            />
            <Pressable
              onPress={onSend}
              disabled={!isOnline}
              style={{
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: "#2563eb",
                opacity: isOnline ? 1 : 0.5,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white" }}>送信</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </MobileFrame>
  );
}
