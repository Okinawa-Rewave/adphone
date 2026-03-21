// app/chat/index.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Link } from "expo-router";
import { Design } from "@/constants/Design";
import { ScreenLayout } from "@/components/ScreenLayout";

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
    <ScreenLayout title="チャット" subtitle="連絡先一覧">
      <View style={styles.container}>
        <View style={styles.roomBox}>
          <Text style={styles.roomLabel}>避難所チャット（roomId）</Text>
          <View style={styles.roomRow}>
            <TextInput
              value={roomId}
              onChangeText={setRoomId}
              placeholder="例：shelter_001"
              placeholderTextColor={Design.colors.textMuted}
              style={styles.roomInput}
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
            placeholderTextColor={Design.colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.listWrap}>
          <SectionList
            style={styles.sectionList}
            contentContainerStyle={styles.sectionListContent}
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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  roomBox: {
    paddingTop: Design.spacing.sm,
    paddingBottom: Design.spacing.sm,
  },
  roomLabel: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textSecondary,
    marginBottom: Design.spacing.sm,
  },
  roomRow: {
    flexDirection: "row",
    gap: Design.spacing.sm,
    alignItems: "center",
  },
  roomInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  roomButton: {
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.primary,
  },
  roomButtonText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  roomHint: {
    marginTop: Design.spacing.sm,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  searchBox: { paddingVertical: Design.spacing.md },
  searchInput: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  listWrap: { flex: 1 },
  sectionList: { flex: 1 },
  sectionListContent: { paddingBottom: Design.spacing.xxl },
  sectionHeader: {
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.sm,
    backgroundColor: Design.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
  },
  sectionHeaderText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.lg,
    backgroundColor: Design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  rowText: { marginLeft: Design.spacing.md, flex: 1 },
  name: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
  preview: {
    marginTop: Design.spacing.xs,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
});
