// contexts/NotificationContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { castVote } from "@/lib/userTrust";

// ─── 型定義 ───────────────────────────────────────────────
export type DisasterType =
  | "earthquake" | "flood" | "fire" | "collapse" | "landslide" | "other";

export type TrustLevel = "official" | "verified" | "partial" | "unverified";

export type Signature = {
  id: string;
  name: string;
  type: "government" | "fire_department" | "local_defense" | "user";
  timestamp: number;
  isOfficial: boolean;
};

export type NotificationItem = {
  id: string;
  text: string;
  time: string;          // 表示用文字列（後方互換）
  unread: boolean;
  href?: string;
  // SNS拡張フィールド（任意）
  disasterType?: DisasterType;
  trustLevel?: TrustLevel;
  trustScore?: number;   // 0〜100
  timestamp?: number;    // Unix ms（鮮度計算用）
  author?: string;
  location?: string;
  signatures?: Signature[];
  nearbyConfirmations?: number;
  impressions?: number;
  hasSigned?: boolean;
  isHelpful?: boolean;
  helpfulCount?: number;
  authorUid?: string;
  authorTrustScore?: number;  // 投稿者の信頼度スコア（0〜100）
  agreeCount?: number;
  disagreeCount?: number;
  myVote?: "agree" | "disagree" | null;
};

// ─── デフォルトデータ ────────────────────────────────────
const NOW = Date.now();

const DEFAULT_ITEMS: NotificationItem[] = [
  {
    id: "n1",
    text: "渋谷区で震度4を観測。余震に引き続き注意してください。避難が必要な方は最寄りの避難所へ。",
    time: "12:01",
    unread: true,
    disasterType: "earthquake",
    trustLevel: "official",
    trustScore: 92,
    timestamp: NOW - 6 * 60 * 1000,
    author: "気象庁",
    authorUid: "uid_jma",
    location: "渋谷区",
    impressions: 1520,
    helpfulCount: 48,
    nearbyConfirmations: 7,
    signatures: [
      { id: "s1", name: "気象庁", type: "government", timestamp: NOW - 6 * 60 * 1000, isOfficial: true },
      { id: "s2", name: "渋谷消防署", type: "fire_department", timestamp: NOW - 4 * 60 * 1000, isOfficial: true },
    ],
  },
  {
    id: "n5",
    text: "松濤付近で大規模火災が発生しています。消防車が複数台出動中。付近の方は速やかに避難してください。",
    time: "12:05",
    unread: true,
    disasterType: "fire",
    trustLevel: "official",
    trustScore: 88,
    timestamp: NOW - 2 * 60 * 1000,
    author: "渋谷消防署",
    authorUid: "uid_shibuya_fd",
    location: "渋谷区松濤",
    impressions: 932,
    helpfulCount: 35,
    nearbyConfirmations: 12,
    signatures: [
      { id: "s7", name: "渋谷消防署", type: "fire_department", timestamp: NOW - 2 * 60 * 1000, isOfficial: true },
      { id: "s8", name: "渋谷区役所", type: "government", timestamp: NOW - 1 * 60 * 1000, isOfficial: true },
    ],
  },
  {
    id: "n9",
    text: "広尾付近の塀が崩壊し、下敷きになっている方がいます。119に通報済み。救助隊が向かっています。",
    time: "12:03",
    unread: true,
    disasterType: "collapse",
    trustLevel: "partial",
    trustScore: 60,
    timestamp: NOW - 4 * 60 * 1000,
    author: "市民レポート",
    authorUid: "uid_citizen_hiroo",
    location: "渋谷区広尾",
    impressions: 754,
    helpfulCount: 31,
    nearbyConfirmations: 8,
    signatures: [
      { id: "s15", name: "広尾住民A", type: "user", timestamp: NOW - 4 * 60 * 1000, isOfficial: false },
      { id: "s16", name: "広尾住民B", type: "user", timestamp: NOW - 3 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n2",
    text: "田中さんからメッセージを受信しました",
    time: "11:48",
    unread: false,
    href: "/chat",
    trustLevel: "verified",
    trustScore: 75,
    timestamp: NOW - 18 * 60 * 1000,
    author: "田中",
    authorUid: "uid_tanaka",
    helpfulCount: 3,
    nearbyConfirmations: 2,
    signatures: [
      { id: "s3", name: "田中", type: "user", timestamp: NOW - 18 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n11",
    text: "幡ヶ谷の集合住宅が倒壊しました。要救助者がいます。救助隊が現地に向かっています。",
    time: "11:50",
    unread: true,
    disasterType: "collapse",
    trustLevel: "official",
    trustScore: 90,
    timestamp: NOW - 17 * 60 * 1000,
    author: "渋谷消防署",
    authorUid: "uid_shibuya_fd",
    location: "渋谷区幡ヶ谷",
    impressions: 1100,
    helpfulCount: 45,
    nearbyConfirmations: 10,
    signatures: [
      { id: "s19", name: "渋谷消防署", type: "fire_department", timestamp: NOW - 17 * 60 * 1000, isOfficial: true },
      { id: "s20", name: "渋谷区役所", type: "government", timestamp: NOW - 15 * 60 * 1000, isOfficial: true },
      { id: "s21", name: "地域防災士 佐藤", type: "local_defense", timestamp: NOW - 13 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n6",
    text: "神泉付近で建物が半壊しています。倒壊の危険があるため、周辺道路には近づかないでください。",
    time: "11:55",
    unread: true,
    disasterType: "collapse",
    trustLevel: "partial",
    trustScore: 65,
    timestamp: NOW - 12 * 60 * 1000,
    author: "市民レポート",
    authorUid: "uid_citizen_kamimizo",
    location: "渋谷区神泉",
    impressions: 420,
    helpfulCount: 19,
    nearbyConfirmations: 5,
    signatures: [
      { id: "s9", name: "神泉町住民A", type: "user", timestamp: NOW - 12 * 60 * 1000, isOfficial: false },
      { id: "s10", name: "神泉町住民B", type: "user", timestamp: NOW - 10 * 60 * 1000, isOfficial: false },
      { id: "s11", name: "地域防災士 山田", type: "local_defense", timestamp: NOW - 8 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n7",
    text: "上原付近でガス漏れが発生しています。東京ガスが対応中。窓を開け、火気厳禁でお願いします。",
    time: "11:40",
    unread: false,
    disasterType: "other",
    trustLevel: "official",
    trustScore: 80,
    timestamp: NOW - 27 * 60 * 1000,
    author: "東京ガス",
    authorUid: "uid_tokyo_gas",
    location: "渋谷区上原",
    impressions: 615,
    helpfulCount: 28,
    nearbyConfirmations: 6,
    signatures: [
      { id: "s12", name: "東京ガス", type: "government", timestamp: NOW - 27 * 60 * 1000, isOfficial: true },
    ],
  },
  {
    id: "n3",
    text: "渋谷川沿いで浸水が確認されています。1階にいる方は上階への避難を強く推奨します。",
    time: "11:20",
    unread: true,
    disasterType: "flood",
    trustLevel: "partial",
    trustScore: 58,
    timestamp: NOW - 46 * 60 * 1000,
    author: "市民レポート",
    authorUid: "uid_citizen_river",
    location: "渋谷区",
    impressions: 340,
    helpfulCount: 21,
    nearbyConfirmations: 4,
    signatures: [
      { id: "s4", name: "渋谷区民A", type: "user", timestamp: NOW - 46 * 60 * 1000, isOfficial: false },
      { id: "s5", name: "渋谷区民B", type: "user", timestamp: NOW - 40 * 60 * 1000, isOfficial: false },
      { id: "s6", name: "地域防災士 鈴木", type: "local_defense", timestamp: NOW - 35 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n8",
    text: "笹塚交差点で車両横転事故が発生。道路が閉鎖されています。迂回路をご利用ください。",
    time: "11:30",
    unread: false,
    disasterType: "other",
    trustLevel: "verified",
    trustScore: 70,
    timestamp: NOW - 37 * 60 * 1000,
    author: "渋谷区民",
    authorUid: "uid_citizen_sasazuka",
    location: "渋谷区笹塚",
    impressions: 288,
    helpfulCount: 14,
    nearbyConfirmations: 3,
    signatures: [
      { id: "s13", name: "笹塚住民A", type: "user", timestamp: NOW - 37 * 60 * 1000, isOfficial: false },
      { id: "s14", name: "笹塚住民B", type: "user", timestamp: NOW - 32 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n10",
    text: "代々木公園内で倒木が多数発生しています。公園への立入は禁止されています。",
    time: "11:10",
    unread: false,
    disasterType: "other",
    trustLevel: "official",
    trustScore: 85,
    timestamp: NOW - 57 * 60 * 1000,
    author: "渋谷区役所",
    authorUid: "uid_shibuya_city",
    location: "渋谷区代々木神園町",
    impressions: 490,
    helpfulCount: 22,
    nearbyConfirmations: 9,
    signatures: [
      { id: "s17", name: "渋谷区役所", type: "government", timestamp: NOW - 57 * 60 * 1000, isOfficial: true },
      { id: "s18", name: "東京都公園協会", type: "government", timestamp: NOW - 55 * 60 * 1000, isOfficial: true },
    ],
  },
  {
    id: "n12",
    text: "千駄ヶ谷付近で転倒して動けない高齢者がいます。近くにいる方は声をかけてください。",
    time: "11:45",
    unread: false,
    disasterType: "other",
    trustLevel: "unverified",
    trustScore: 35,
    timestamp: NOW - 22 * 60 * 1000,
    author: "通行人",
    authorUid: "uid_passerby",
    location: "渋谷区千駄ヶ谷",
    impressions: 145,
    helpfulCount: 8,
    nearbyConfirmations: 2,
    signatures: [
      { id: "s22", name: "通行人A", type: "user", timestamp: NOW - 22 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n4",
    text: "ネットワークに接続しました。BLEメッシュ経由で周辺デバイスと通信中です。",
    time: "10:55",
    unread: false,
    timestamp: NOW - 71 * 60 * 1000,
    trustLevel: "unverified",
    trustScore: 20,
    author: "システム",
    helpfulCount: 0,
  },
];

// ─── Context 定義 ─────────────────────────────────────────
type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  addItem: (item: NotificationItem) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  toggleRead: (id: string) => void;
  signPost: (id: string) => void;
  toggleHelpful: (id: string) => void;
  disagreePost: (id: string) => void;
  refresh: () => Promise<void>;
  lastRefreshedAt: Date | null;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────
const STORAGE_KEY = "@notifications_v2";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>(DEFAULT_ITEMS);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const unreadCount = items.filter((x) => x.unread).length;

  const persist = useCallback((next: NotificationItem[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as NotificationItem[];
          if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, unread: false } : x));
      persist(next);
      return next;
    });
  }, [persist]);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((x) => ({ ...x, unread: false }));
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) =>
        x.id === id ? { ...x, unread: !x.unread } : x
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const signPost = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      const hasSigned = target ? !target.hasSigned : true;

      // Firestoreへの投票（authorUidがある投稿のみ）
      if (target?.authorUid) {
        const prevVote = target.myVote ?? null;
        const nextVote = hasSigned ? "agree" : null;
        if (nextVote !== prevVote) {
          castVote(id, target.authorUid, "agree").catch(() => {});
        }
      }

      const next = prev.map((x) => {
        if (x.id !== id) return x;
        const newSig: Signature = {
          id: `sig-${Date.now()}`,
          name: "あなた",
          type: "user",
          timestamp: Date.now(),
          isOfficial: false,
        };
        const prevAgree = x.agreeCount ?? 0;
        return {
          ...x,
          hasSigned,
          myVote: hasSigned ? "agree" : null,
          signatures: hasSigned
            ? [...(x.signatures ?? []), newSig]
            : (x.signatures ?? []).filter((s) => s.name !== "あなた"),
          trustScore: Math.min(100, (x.trustScore ?? 0) + (hasSigned ? 5 : -5)),
          agreeCount: hasSigned ? prevAgree + 1 : Math.max(0, prevAgree - 1),
        };
      });
      persist(next);
      return next;
    });
  }, [persist]);

  const disagreePost = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);

      // Firestoreへの投票（authorUidがある投稿のみ）
      if (target?.authorUid) {
        castVote(id, target.authorUid, "disagree").catch(() => {});
      }

      const next = prev.map((x) => {
        if (x.id !== id) return x;
        const isDisagreeing = x.myVote !== "disagree";
        const prevDisagree = x.disagreeCount ?? 0;
        return {
          ...x,
          myVote: isDisagreeing ? "disagree" : null,
          hasSigned: isDisagreeing ? false : x.hasSigned,
          trustScore: Math.max(0, (x.trustScore ?? 0) + (isDisagreeing ? -5 : 5)),
          disagreeCount: isDisagreeing
            ? prevDisagree + 1
            : Math.max(0, prevDisagree - 1),
          agreeCount: isDisagreeing && x.myVote === "agree"
            ? Math.max(0, (x.agreeCount ?? 0) - 1)
            : x.agreeCount,
        };
      });
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleHelpful = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) => {
        if (x.id !== id) return x;
        const isHelpful = !x.isHelpful;
        return {
          ...x,
          isHelpful,
          helpfulCount: (x.helpfulCount ?? 0) + (isHelpful ? 1 : -1),
        };
      });
      persist(next);
      return next;
    });
  }, [persist]);

  const addItem = useCallback((item: NotificationItem) => {
    setItems((prev) => {
      // 同一IDが既に存在する場合はスキップ（重複防止）
      if (prev.some((x) => x.id === item.id)) return prev;
      const next = [item, ...prev].slice(0, 200);
      persist(next);
      return next;
    });
  }, [persist]);

  const refresh = useCallback(async () => {
    const now = new Date();
    const t = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const newItem: NotificationItem = {
      id: `r-${Date.now()}`,
      text: "通知を再取得しました",
      time: t,
      unread: false,
      timestamp: Date.now(),
      trustLevel: "unverified",
      trustScore: 0,
      author: "システム",
    };
    setItems((prev) => {
      const next = [newItem, ...prev.slice(0, 19)];
      persist(next);
      return next;
    });
    setLastRefreshedAt(now);
  }, [persist]);

  return (
    <NotificationContext.Provider
      value={{ items, unreadCount, addItem, markRead, markAllRead, toggleRead, signPost, toggleHelpful, disagreePost, refresh, lastRefreshedAt }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
