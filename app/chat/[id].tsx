// app/chat/[id].tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Send } from "lucide-react-native";
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";


type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
};

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "1", fromMe: false, text: "こんにちは！", time: "09:12" },
    { id: "2", fromMe: true, text: "今どこ？", time: "09:13" },
  ]);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    const t = inputText.trim();
    if (!t) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), fromMe: true, text: t, time: new Date().toTimeString().slice(0, 5) },
    ]);
    setInputText("");

    // TODO: ここで BLE/LoRa に送信（宛先は id を使う）
  };

  return (
    <MobileFrame>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ヘッダー */}
        <BrowserHeader />
        <AppHeader
          title={name ?? "チャット"}
          subtitle={id ? `ID: ${id}` : undefined}
        />


        {/* メッセージ */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {messages.map((m) => (
            <View key={m.id} style={[styles.row, m.fromMe ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, m.fromMe ? styles.bubbleMe : styles.bubbleOther]}>
                <Text style={[styles.text, m.fromMe ? styles.textMe : styles.textOther]}>{m.text}</Text>
                <Text style={[styles.time, m.fromMe ? styles.timeMe : styles.timeOther]}>{m.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* 入力 */}
        <View style={styles.inputArea}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力…"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e5e7eb" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingRight: 8 },
  backText: { marginLeft: 4, fontSize: 14, color: "#4b5563" },
  headerCenter: { flex: 1, alignItems: "center", marginRight: 40 },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 12, color: "#6b7280" },

  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 16 },

  row: { marginBottom: 8, flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOther: { backgroundColor: "#fff", borderTopLeftRadius: 4 },
  bubbleMe: { backgroundColor: "#3b82f6", borderTopRightRadius: 4 },

  text: { fontSize: 14 },
  textOther: { color: "#111827" },
  textMe: { color: "#fff" },

  time: { fontSize: 10, marginTop: 2 },
  timeOther: { color: "#9ca3af", textAlign: "left" },
  timeMe: { color: "#bfdbfe", textAlign: "right" },

  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: "#9ca3af" },
});
