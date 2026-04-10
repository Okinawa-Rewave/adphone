/**
 * RegionalChatView — 地域チャット本体
 * Firebaseのrooms/regional_default/messagesをリアルタイム購読
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
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
import { Send, Wifi, WifiOff } from "lucide-react-native";
import { Design } from "@/constants/Design";
import {
  RegionalChatBubble,
  type RegionalMessage,
} from "@/components/RegionalChatBubble";
import { LpwaChatView } from "@/components/LpwaChatView";

const ROOM_ID = "regional_default";

interface Profile {
  nickname: string;
  icon: string;
  location?: string;
}

interface Props {
  onlineCount?: number;
}

export function RegionalChatView({ onlineCount }: Props) {
  const { isOnline } = useOnline();
  const [chatChannel, setChatChannel] = useState<"cloud" | "lpwa">("cloud");
  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState<Profile>({
    nickname: "匿名",
    icon: "🙂",
    location: "",
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<RegionalMessage[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  // 認証 + プロフィール取得
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
            location: d.location ?? "",
          });
        }
      }
    })();
  }, []);

  // Firestore 購読
  useEffect(() => {
    if (!isOnline) {
      unsubRef.current?.();
      return;
    }
    const q = query(
      collection(db, "rooms", ROOM_ID, "messages"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            text: data.text ?? "",
            senderId: data.senderId ?? "",
            senderName: data.senderName ?? "匿名",
            senderIcon: data.senderIcon ?? "🙂",
            location: data.location ?? "",
            isOfficial: data.isOfficial ?? false,
            createdAt: data.createdAt,
          } satisfies RegionalMessage;
        })
      );
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [isOnline]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !isOnline) return;
    setInput("");
    await addDoc(collection(db, "rooms", ROOM_ID, "messages"), {
      text,
      senderId: auth.currentUser?.uid ?? uid ?? "unknown",
      senderName: profile.nickname,
      senderIcon: profile.icon,
      location: profile.location ?? "",
      isOfficial: false,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── ステータスバー ── */}
      <View
        style={[
          styles.statusBar,
          isOnline ? styles.statusOnline : styles.statusOffline,
        ]}
      >
        {isOnline ? (
          <Wifi size={12} color={Design.colors.trustVerified} strokeWidth={2.5} />
        ) : (
          <WifiOff size={12} color={Design.colors.danger} strokeWidth={2.5} />
        )}
        <Text
          style={[
            styles.statusText,
            {
              color: isOnline
                ? Design.colors.trustVerified
                : Design.colors.danger,
            },
          ]}
        >
          {isOnline
            ? `リアルタイム情報共有 — 現在地周辺${onlineCount ? ` (${onlineCount}人)` : ""}`
            : "オフライン — 送信できません"}
        </Text>
        {isOnline && <View style={styles.pulseDot} />}
      </View>

      {/* ── チャンネルサブタブ ── */}
      <View style={styles.channelTab}>
        <TouchableOpacity
          style={[styles.channelBtn, chatChannel === "cloud" && styles.channelBtnActive]}
          onPress={() => setChatChannel("cloud")}
          activeOpacity={0.75}
        >
          <Text style={[styles.channelBtnText, chatChannel === "cloud" && styles.channelBtnTextActive]}>
            ☁️ クラウド
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.channelBtn, chatChannel === "lpwa" && styles.channelBtnActive]}
          onPress={() => setChatChannel("lpwa")}
          activeOpacity={0.75}
        >
          <Text style={[styles.channelBtnText, chatChannel === "lpwa" && styles.channelBtnTextActive]}>
            📡 LPWA
          </Text>
        </TouchableOpacity>
      </View>

      {chatChannel === "lpwa" ? (
        <LpwaChatView />
      ) : (
        <>
          {/* ── メッセージフィード ── */}
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            inverted
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RegionalChatBubble message={item} myUid={uid} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  まだメッセージがありません。{"\n"}最初の情報を共有しましょう。
                </Text>
              </View>
            }
          />

          {/* ── 入力エリア ── */}
          <View style={styles.inputArea}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="情報を共有..."
              placeholderTextColor={Design.colors.textMuted}
              style={styles.input}
              multiline
              maxLength={500}
              editable={isOnline}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!isOnline || !input.trim()) && styles.sendBtnDisabled,
              ]}
              onPress={onSend}
              disabled={!isOnline || !input.trim()}
              activeOpacity={0.8}
            >
              <Send size={18} color={Design.colors.white} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  statusOnline: {
    backgroundColor: Design.colors.trustVerifiedMuted,
    borderBottomColor: Design.colors.trustVerified + "30",
  },
  statusOffline: {
    backgroundColor: Design.colors.dangerMuted,
    borderBottomColor: Design.colors.danger + "30",
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Design.colors.trustVerified,
    marginLeft: "auto",
  },
  statusText: {
    fontSize: 12,
    fontWeight: Design.fontWeight.semi,
    flex: 1,
  },
  channelTab: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  channelBtn: {
    flex: 1,
    paddingVertical: Design.spacing.sm,
    alignItems: "center",
  },
  channelBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: Design.colors.primary,
  },
  channelBtnText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },
  channelBtnTextActive: {
    color: Design.colors.primary,
  },
  listContent: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Design.spacing.sm,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    backgroundColor: Design.colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.xl,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    backgroundColor: Design.colors.surface,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },
});
