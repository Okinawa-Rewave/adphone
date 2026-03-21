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
  StyleSheet,
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

import { Design } from "@/constants/Design";
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
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            inverted
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const myUid = auth.currentUser?.uid ?? uid;
              const mine = item.senderId === myUid;

              return (
                <View
                  style={[
                    styles.messageRow,
                    mine ? styles.messageRowRight : styles.messageRowLeft,
                  ]}
                >
                  {!mine && (
                    <View style={styles.iconWrap}>
                      <Text style={styles.iconText}>
                        {item.senderIcon ?? "🙂"}
                      </Text>
                    </View>
                  )}

                  <View style={styles.bubbleWrap}>
                    {!mine && (
                      <Text style={styles.senderName}>
                        {item.senderName ?? "匿名"}
                      </Text>
                    )}

                    <View
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMe : styles.bubbleOther,
                      ]}
                    >
                      <Text style={styles.bubbleText}>{item.text}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="メッセージ"
              placeholderTextColor={Design.colors.textMuted}
              style={styles.input}
            />
            <Pressable
              onPress={onSend}
              disabled={!isOnline}
              style={[styles.sendBtn, !isOnline && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendBtnText}>送信</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  content: {
    flex: 1,
    padding: Design.spacing.lg,
  },
  listContent: { paddingBottom: Design.spacing.sm },
  messageRow: {
    flexDirection: "row",
    marginVertical: Design.spacing.sm,
  },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },
  iconWrap: { marginRight: Design.spacing.sm, alignItems: "center" },
  iconText: { fontSize: Design.fontSize.title },
  bubbleWrap: { maxWidth: "75%" },
  senderName: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    marginBottom: Design.spacing.xs,
  },
  bubble: {
    padding: Design.spacing.md,
    borderRadius: Design.radius.lg,
  },
  bubbleMe: { backgroundColor: Design.colors.primary },
  bubbleOther: { backgroundColor: Design.colors.text },
  bubbleText: {
    color: Design.colors.background,
    fontSize: Design.fontSize.body,
  },
  inputRow: {
    flexDirection: "row",
    gap: Design.spacing.sm,
    marginTop: Design.spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    backgroundColor: Design.colors.background,
  },
  sendBtn: {
    paddingHorizontal: Design.spacing.lg,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
  },
});
