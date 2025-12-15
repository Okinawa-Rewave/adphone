// app/chat/index.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { MobileFrame } from "@/components/MobileFrame";
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";

type Contact = {
  id: string;
  name: string;
  kana: string;
  lastMessage?: string;
};

const CONTACTS: Contact[] = [
  { id: "c1", name: "あさひ", kana: "あさひ", lastMessage: "了解です" },
  { id: "c2", name: "いとう", kana: "いとう", lastMessage: "今どこ？" },
  { id: "c3", name: "うえだ", kana: "うえだ" },
  { id: "c4", name: "かみや", kana: "かみや", lastMessage: "受信できました" },
  { id: "c5", name: "さとう", kana: "さとう" },
  { id: "c6", name: "たなか", kana: "たなか" },
  { id: "c7", name: "Michael", kana: "Michael" },
  { id: "c8", name: "花山", kana: "はなやま" },
];

function toKanaGroup(kana: string) {
  const c = (kana?.trim() || "その他")[0];
  const map: Record<string, string> = {
    あ: "あ", い: "あ", う: "あ", え: "あ", お: "あ",
    か: "か", き: "か", く: "か", け: "か", こ: "か",
    が: "か", ぎ: "か", ぐ: "か", げ: "か", ご: "か",
    さ: "さ", し: "さ", す: "さ", せ: "さ", そ: "さ",
    ざ: "さ", じ: "さ", ず: "さ", ぜ: "さ", ぞ: "さ",
    た: "た", ち: "た", つ: "た", て: "た", と: "た",
    だ: "た", ぢ: "た", づ: "た", で: "た", ど: "た",
    な: "な", に: "な", ぬ: "な", ね: "な", の: "な",
    は: "は", ひ: "は", ふ: "は", へ: "は", ほ: "は",
    ば: "は", び: "は", ぶ: "は", べ: "は", ぼ: "は",
    ぱ: "は", ぴ: "は", ぷ: "は", ぺ: "は", ぽ: "は",
    ま: "ま", み: "ま", む: "ま", め: "ま", も: "ま",
    や: "や", ゆ: "や", よ: "や",
    ら: "ら", り: "ら", る: "ら", れ: "ら", ろ: "ら",
    わ: "わ", を: "わ", ん: "わ",
  };
  return map[c] ?? "その他";
}

export default function ChatContactsScreen() {
  const [q, setQ] = useState("");

  // ✅ 追加：避難所ID入力（デフォは shelter_001 など）
  const [roomId, setRoomId] = useState("shelter_001");

  const sections = useMemo(() => {
    const filtered = CONTACTS.filter((c) => {
      const key = `${c.name} ${c.kana}`.toLowerCase();
      return key.includes(q.trim().toLowerCase());
    });

    const grouped = new Map<string, Contact[]>();
    for (const c of filtered) {
      const g = toKanaGroup(c.kana);
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(c);
    }

    const order = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "その他"];
    return order
      .filter((k) => grouped.has(k))
      .map((k) => ({
        title: k,
        data: grouped.get(k)!.sort((a, b) => a.kana.localeCompare(b.kana, "ja")),
      }));
  }, [q]);

  const roomIdTrimmed = roomId.trim();

  return (
    <MobileFrame>
      <View style={styles.container}>
        <BrowserHeader />
        <AppHeader title="チャット" subtitle="連絡先一覧" />

        {/* ✅ 追加：避難所チャット導線 */}
        <View style={styles.roomBox}>
          <Text style={styles.roomLabel}>避難所チャット（roomId）</Text>
          <View style={styles.roomRow}>
            <TextInput
              value={roomId}
              onChangeText={setRoomId}
              placeholder="例：shelter_001"
              placeholderTextColor="#9ca3af"
              style={[styles.roomInput]}
              autoCapitalize="none"
            />
            <Link
              href={{
                pathname: "/chat/room/[roomId]",
                params: { roomId: roomIdTrimmed || "shelter_001" },
              }}
              asChild
            >
              <TouchableOpacity
                style={[styles.roomButton, { opacity: roomIdTrimmed ? 1 : 0.6 }]}
                disabled={!roomIdTrimmed}
              >
                <Text style={styles.roomButtonText}>入室</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <Text style={styles.roomHint}>※ 例：shelter_001（避難所IDでルームを分けます）</Text>
        </View>

        {/* 検索 */}
        <View style={styles.searchBox}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="連絡先を検索…"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>

        {/* 連絡先一覧 */}
        <View style={{ flex: 1 }}>
          <SectionList
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <Link
                href={{
                  pathname: "/chat/[id]",
                  params: { id: item.id, name: item.name },
                }}
                asChild
              >
                <TouchableOpacity style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.slice(0, 1)}</Text>
                  </View>

                  <View style={styles.rowText}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {item.lastMessage ?? "—"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            )}
          />
        </View>
      </View>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffffff" },

  // ✅ 追加：避難所チャット導線
  roomBox: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  roomLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
  roomRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  roomInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  roomButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  roomButtonText: { color: "black", fontWeight: "700" },
  roomHint: { marginTop: 6, fontSize: 11, color: "#6b7280" },

  searchBox: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  sectionHeaderText: { fontSize: 14, fontWeight: "700", color: "#111827" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#111827" },

  rowText: { marginLeft: 12, flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#111827" },
  preview: { marginTop: 2, fontSize: 12, color: "#6b7280" },
});
