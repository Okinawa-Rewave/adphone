// app/chat.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { MobileFrame } from "@/components/MobileFrame";
import { ArrowLeft, Send } from "lucide-react-native";
import { Link } from "expo-router";

type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      fromMe: false,
      text: "避難所の状況どう？",
      time: "09:12",
    },
    {
      id: "2",
      fromMe: true,
      text: "今は落ち着いてます。人は30人くらいです。",
      time: "09:13",
    },
  ]);

  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      fromMe: true,
      text: inputText.trim(),
      time: new Date().toTimeString().slice(0, 5),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // TODO: ここで BLE/LoRa 経由の送信ロジックを呼ぶ
  };

  return (
    <MobileFrame>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.backButton}>
              <ArrowLeft size={20} color="#111827" />
              <Text style={styles.backText}>ホーム</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>チャット</Text>
            <Text style={styles.subtitle}>防災ネットワーク</Text>
          </View>
        </View>

        {/* メッセージ一覧 */}
        <ScrollView
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.fromMe ? styles.messageRowRight : styles.messageRowLeft,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  msg.fromMe ? styles.bubbleMe : styles.bubbleOther,
                ]}
              >
                <Text style={styles.bubbleText}>{msg.text}</Text>
                <Text
                  style={[
                    styles.time,
                    msg.fromMe ? styles.timeRight : styles.timeLeft,
                  ]}
                >
                  {msg.time}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* 入力エリア */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力..."
            placeholderTextColor="#9ca3af"
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#4b5563",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginRight: 40, // 戻るボタン分のバランス
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 12,
    paddingBottom: 16,
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: "row",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOther: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: "#3b82f6",
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: "#111827",
  },
  time: {
    fontSize: 10,
    marginTop: 2,
  },
  timeLeft: {
    color: "#9ca3af",
    textAlign: "left",
  },
  timeRight: {
    color: "#bfdbfe",
    textAlign: "right",
  },
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
    backgroundColor: "#ffffff",
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
  sendButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
});
