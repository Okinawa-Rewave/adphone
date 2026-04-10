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
import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

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
      {
        id: Date.now().toString(),
        fromMe: true,
        text: t,
        time: new Date().toTimeString().slice(0, 5),
      },
    ]);
    setInputText("");
  };

  return (
    <ScreenLayout
      title={name ?? "チャット"}
      subtitle={id ? `ID: ${id}` : undefined}
      contentStyle={styles.content}
    >
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.row, m.fromMe ? styles.rowRight : styles.rowLeft]}
            >
              <View
                style={[
                  styles.bubble,
                  m.fromMe ? styles.bubbleMe : styles.bubbleOther,
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    m.fromMe ? styles.textMe : styles.textOther,
                  ]}
                >
                  {m.text}
                </Text>
                <Text
                  style={[
                    styles.time,
                    m.fromMe ? styles.timeMe : styles.timeOther,
                  ]}
                >
                  {m.time}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputArea}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力…"
            placeholderTextColor={Design.colors.textMuted}
            style={styles.input}
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
            <Send size={22} color={Design.colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Design.spacing.lg,
    paddingTop: Design.spacing.lg,
    flex: 1,
  },
  kav: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    padding: Design.spacing.lg,
    paddingBottom: Design.spacing.xl,
  },
  row: {
    marginBottom: Design.spacing.sm,
    flexDirection: "row",
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "80%",
    borderRadius: Design.radius.lg,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
  },
  bubbleOther: {
    backgroundColor: Design.colors.background,
    borderTopLeftRadius: Design.radius.xs,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  bubbleMe: {
    backgroundColor: Design.colors.primary,
    borderTopRightRadius: Design.radius.xs,
  },
  text: { fontSize: Design.fontSize.body },
  textOther: { color: Design.colors.text },
  textMe: { color: Design.colors.white },
  time: {
    fontSize: Design.fontSize.caption,
    marginTop: Design.spacing.xs,
  },
  timeOther: {
    color: Design.colors.textMuted,
    textAlign: "left",
  },
  timeMe: {
    color: "rgba(255,255,255,0.85)",
    textAlign: "right",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    backgroundColor: Design.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
    marginHorizontal: -Design.spacing.lg,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.xl,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  sendButton: {
    marginLeft: Design.spacing.sm,
    width: 48,
    height: 48,
    borderRadius: Design.radius.lg,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Design.colors.textMuted,
  },
});
