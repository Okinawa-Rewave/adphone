/**
 * ContactListView — 個人チャット一覧
 * ・「最近」セクション（未読 or lastMessage あり）を最上部に表示
 * ・カラーアバター（名前ハッシュで自動色割り当て）
 * ・未読バッジ + lastMessage + 時刻
 * ・検索（名前・かな対応）
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { Design } from "@/constants/Design";

// ─── データ型 ─────────────────────────────────────────
export type Contact = {
  id: string;
  name: string;
  kana: string;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
};

// ─── サンプルデータ ───────────────────────────────────
const CONTACTS: Contact[] = [
  { id: "c1", name: "あさひ",  kana: "あさひ",   lastMessage: "了解です",     lastTime: "09:12" },
  { id: "c2", name: "いとう",  kana: "いとう",   lastMessage: "今どこ？",     lastTime: "10:05", unreadCount: 2 },
  { id: "c3", name: "うえだ",  kana: "うえだ",   lastMessage: undefined,      lastTime: undefined },
  { id: "c4", name: "かみや",  kana: "かみや",   lastMessage: "受信できました",lastTime: "11:30", unreadCount: 1 },
  { id: "c5", name: "さとう",  kana: "さとう",   lastMessage: undefined,      lastTime: undefined },
  { id: "c6", name: "たなか",  kana: "たなか",   lastMessage: "ありがとう",   lastTime: "08:55" },
  { id: "c7", name: "Michael", kana: "Michael",  lastMessage: "OK!",          lastTime: "07:40" },
  { id: "c8", name: "花山",    kana: "はなやま", lastMessage: undefined,      lastTime: undefined },
];

// ─── ユーティリティ ───────────────────────────────────
const AVATAR_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#059669",
  "#d97706", "#0891b2", "#65a30d", "#dc2626",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function toKanaGroup(kana: string): string {
  const c = (kana?.trim() || "その他")[0];
  const map: Record<string, string> = {
    あ:"あ",い:"あ",う:"あ",え:"あ",お:"あ",
    か:"か",き:"か",く:"か",け:"か",こ:"か",
    が:"か",ぎ:"か",ぐ:"か",げ:"か",ご:"か",
    さ:"さ",し:"さ",す:"さ",せ:"さ",そ:"さ",
    ざ:"さ",じ:"さ",ず:"さ",ぜ:"さ",ぞ:"さ",
    た:"た",ち:"た",つ:"た",て:"た",と:"た",
    だ:"た",ぢ:"た",づ:"た",で:"た",ど:"た",
    な:"な",に:"な",ぬ:"な",ね:"な",の:"な",
    は:"は",ひ:"は",ふ:"は",へ:"は",ほ:"は",
    ば:"は",び:"は",ぶ:"は",べ:"は",ぼ:"は",
    ぱ:"は",ぴ:"は",ぷ:"は",ぺ:"は",ぽ:"は",
    ま:"ま",み:"ま",む:"ま",め:"ま",も:"ま",
    や:"や",ゆ:"や",よ:"や",
    ら:"ら",り:"ら",る:"ら",れ:"ら",ろ:"ら",
    わ:"わ",を:"わ",ん:"わ",
  };
  return map[c] ?? "その他";
}

// ─── ContactRow ──────────────────────────────────────
function ContactRow({ item, onPress }: { item: Contact; onPress: () => void }) {
  const color = avatarColor(item.name);
  const hasUnread = (item.unreadCount ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* カラーアバター */}
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{item.name.slice(0, 1)}</Text>
      </View>

      {/* テキスト */}
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]}>
            {item.name}
          </Text>
          {item.lastTime && (
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {item.lastTime}
            </Text>
          )}
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {item.lastMessage ?? "——"}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── メインコンポーネント ─────────────────────────────
export function ContactListView() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const sections = useMemo(() => {
    const filtered = CONTACTS.filter((c) =>
      `${c.name} ${c.kana}`.toLowerCase().includes(q.trim().toLowerCase())
    );

    const result: { title: string; data: Contact[] }[] = [];

    // 「最近」セクション：unread あり or lastMessage あり
    const recent = filtered
      .filter((c) => (c.unreadCount ?? 0) > 0 || c.lastMessage)
      .sort((a, b) => {
        const ua = a.unreadCount ?? 0;
        const ub = b.unreadCount ?? 0;
        return ub - ua; // 未読多い順
      });
    if (recent.length > 0) {
      result.push({ title: "最近", data: recent });
    }

    // 五十音グループ
    const kanaOrder = ["あ","か","さ","た","な","は","ま","や","ら","わ","その他"];
    const grouped = new Map<string, Contact[]>();
    for (const c of filtered) {
      const g = toKanaGroup(c.kana);
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(c);
    }
    kanaOrder
      .filter((k) => grouped.has(k))
      .forEach((k) => {
        result.push({
          title: `連絡先 — ${k}行`,
          data: grouped.get(k)!.sort((a, b) =>
            a.kana.localeCompare(b.kana, "ja")
          ),
        });
      });

    return result;
  }, [q]);

  const navigate = (item: Contact) => {
    router.push({
      pathname: "/chat/[id]",
      params: { id: item.id, name: item.name },
    } as any);
  };

  return (
    <View style={styles.root}>
      {/* 検索バー */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={Design.colors.textMuted} strokeWidth={2} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="連絡先を検索…"
            placeholderTextColor={Design.colors.textMuted}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* 連絡先リスト */}
      <SectionList
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ContactRow item={item} onPress={() => navigate(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>連絡先が見つかりません</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  searchWrap: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    backgroundColor: Design.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    backgroundColor: Design.colors.surfaceElevated,
    borderRadius: Design.radius.xl,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
  },

  listContent: { paddingBottom: 24 },

  sectionHeader: {
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    backgroundColor: Design.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Design.colors.border,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.borderLight,
    backgroundColor: Design.colors.background,
    gap: Design.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.white,
  },
  rowText: { flex: 1 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
  nameUnread: { fontWeight: Design.fontWeight.bold },
  time: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  timeUnread: { color: Design.colors.primary, fontWeight: Design.fontWeight.semi },
  preview: {
    flex: 1,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    marginRight: Design.spacing.sm,
  },
  previewUnread: { color: Design.colors.text, fontWeight: Design.fontWeight.semi },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Design.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
  },
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
  },
});
