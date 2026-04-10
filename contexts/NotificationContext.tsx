// contexts/NotificationContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
};

// ─── デフォルトデータ ────────────────────────────────────
const NOW = Date.now();

const DEFAULT_ITEMS: NotificationItem[] = [
  {
    id: "n1",
    text: "○○地区で震度4を観測。余震に引き続き注意してください。避難が必要な方は最寄りの避難所へ。",
    time: "12:01",
    unread: true,
    disasterType: "earthquake",
    trustLevel: "official",
    trustScore: 92,
    timestamp: NOW - 6 * 60 * 1000,
    author: "気象庁",
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
    id: "n2",
    text: "田中さんからメッセージを受信しました",
    time: "11:48",
    unread: false,
    href: "/chat",
    trustLevel: "verified",
    trustScore: 75,
    timestamp: NOW - 18 * 60 * 1000,
    author: "田中",
    helpfulCount: 3,
    nearbyConfirmations: 2,
    signatures: [
      { id: "s3", name: "田中", type: "user", timestamp: NOW - 18 * 60 * 1000, isOfficial: false },
    ],
  },
  {
    id: "n3",
    text: "△△川沿いで浸水が確認されています。1階にいる方は上階への避難を強く推奨します。",
    time: "11:20",
    unread: true,
    disasterType: "flood",
    trustLevel: "partial",
    trustScore: 58,
    timestamp: NOW - 46 * 60 * 1000,
    author: "市民レポート",
    location: "世田谷区",
    impressions: 340,
    helpfulCount: 21,
    nearbyConfirmations: 4,
    signatures: [
      { id: "s4", name: "世田谷区民A", type: "user", timestamp: NOW - 46 * 60 * 1000, isOfficial: false },
      { id: "s5", name: "世田谷区民B", type: "user", timestamp: NOW - 40 * 60 * 1000, isOfficial: false },
      { id: "s6", name: "地域防災士 鈴木", type: "local_defense", timestamp: NOW - 35 * 60 * 1000, isOfficial: false },
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
      const next = prev.map((x) => {
        if (x.id !== id) return x;
        const hasSigned = !x.hasSigned;
        const newSig: Signature = {
          id: `sig-${Date.now()}`,
          name: "あなた",
          type: "user",
          timestamp: Date.now(),
          isOfficial: false,
        };
        return {
          ...x,
          hasSigned,
          signatures: hasSigned
            ? [...(x.signatures ?? []), newSig]
            : (x.signatures ?? []).filter((s) => s.name !== "あなた"),
          trustScore: Math.min(100, (x.trustScore ?? 0) + (hasSigned ? 5 : -5)),
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
      value={{ items, unreadCount, addItem, markRead, markAllRead, toggleRead, signPost, toggleHelpful, refresh, lastRefreshedAt }}
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
