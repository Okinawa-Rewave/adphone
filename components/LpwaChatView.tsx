/**
 * LpwaChatView — LPWA ブロードキャストチャット UI
 *
 * RegionalChatView と同じレイアウト構成（KeyboardAvoidingView + FlatList + 入力エリア）。
 * メッセージ表示は既存の RegionalChatBubble を再利用。
 * 送受信は BLE sendText() 経由。自分のメッセージの下に配送状態（Pi が返す）を表示する。
 */

import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Radio, Send, WifiOff } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { RegionalChatBubble, type RegionalMessage } from "@/components/RegionalChatBubble";
import { DeliveryStatusLabel } from "@/components/DeliveryStatusLabel";
import { useBleContext } from "@/contexts/BleContext";
import { useLpwaChat } from "@/contexts/LpwaChatContext";
import { encodeChatMessage, makeChatId, type LpwaChatMessage } from "@/lib/chatPayload";
import { ensureAnonAuth } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Profile {
  nickname: string;
  icon: string;
}

function toRegionalMessage(m: LpwaChatMessage): RegionalMessage {
  return {
    id: m.id,
    text: m.text,
    senderName: m.senderName,
    senderIcon: m.senderIcon,
    senderId: m.senderIdShort,
    createdAt: m.timestamp * 1000, // Unix ms → formatHHMM で使える
  };
}

export function LpwaChatView() {
  const { bleState, connectedCount, sendText, deliveryStatus } = useBleContext();
  const { messages, myIdShort, addMessage } = useLpwaChat();
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<Profile>({ nickname: "匿名", icon: "🙂" });

  const isConnected = bleState === "connected";

  // プロフィール取得（RegionalChatView と同じ処理）
  useEffect(() => {
    (async () => {
      const user = await ensureAnonAuth();
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setProfile({
            nickname: d.nickname ?? "匿名",
            icon: d.icon ?? "🙂",
          });
        }
      } catch {
        // プロフィール取得失敗は非致命的
      }
    })();
  }, []);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !isConnected || !myIdShort) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const msg: LpwaChatMessage = {
      id: makeChatId({ timestamp, senderIdShort: myIdShort, text }),
      text,
      senderName: profile.nickname,
      senderIcon: profile.icon,
      senderIdShort: myIdShort,
      timestamp,
    };

    setInput("");
    addMessage(msg);                          // 自分のフィードに即時追加
    await sendText(encodeChatMessage(msg), { key: msg.id });   // BLE 送信（配送状態は msg.id で引く）
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ステータスバー */}
      <View style={[styles.statusBar, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
        {isConnected ? (
          <Radio size={12} color={Design.colors.trustVerified} strokeWidth={2.5} />
        ) : (
          <WifiOff size={12} color={Design.colors.danger} strokeWidth={2.5} />
        )}
        <Text style={[styles.statusText, { color: isConnected ? Design.colors.trustVerified : Design.colors.danger }]}>
          {isConnected
            ? `LPWA経由でブロードキャスト${connectedCount ? ` — 近隣 ${connectedCount}台接続中` : ""}`
            : "BLE未接続 — 送信できません"}
        </Text>
        {isConnected && <View style={styles.pulseDot} />}
      </View>

      {/* メッセージフィード */}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const status = item.senderIdShort === myIdShort ? deliveryStatus[item.id] : undefined;
          return (
            <View>
              <RegionalChatBubble message={toRegionalMessage(item)} myUid={myIdShort} />
              {status && <DeliveryStatusLabel info={status} />}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              まだメッセージがありません。{"\n"}LPWAで周辺に情報を共有しましょう。
            </Text>
          </View>
        }
      />

      {/* 入力エリア */}
      <View style={styles.inputArea}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="LPWAで送信..."
          placeholderTextColor={Design.colors.textMuted}
          style={styles.input}
          multiline
          maxLength={200}
          editable={isConnected}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!isConnected || !input.trim()) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!isConnected || !input.trim()}
          activeOpacity={0.8}
        >
          <Send size={18} color={Design.colors.white} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
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
  statusConnected: {
    backgroundColor: Design.colors.trustVerifiedMuted,
    borderBottomColor: Design.colors.trustVerified + "30",
  },
  statusDisconnected: {
    backgroundColor: Design.colors.dangerMuted,
    borderBottomColor: Design.colors.danger + "30",
  },
  statusText: {
    fontSize: 12,
    fontWeight: Design.fontWeight.semi,
    flex: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Design.colors.trustVerified,
    marginLeft: "auto",
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
