// contexts/NotificationContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type NotificationItem = {
  id: string;
  text: string;
  time: string;
  unread: boolean;
  /** チャットなど紐づく画面へのリンク（任意） */
  href?: string;
};

const STORAGE_KEY = "@notifications";

const DEFAULT_ITEMS: NotificationItem[] = [
  { id: "n1", text: "田中さんからメッセージを受信しました", time: "12:01", unread: true, href: "/chat" },
  { id: "n2", text: "佐藤さんにメッセージを送信しました", time: "11:48", unread: false, href: "/chat" },
  { id: "n3", text: "ネットワークに接続しました", time: "11:20", unread: true },
  { id: "n4", text: "オフラインでしたが再接続しました", time: "10:55", unread: false },
];

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  toggleRead: (id: string) => void;
  refresh: () => Promise<void>;
  lastRefreshedAt: Date | null;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>(DEFAULT_ITEMS);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const unreadCount = items.filter((x) => x.unread).length;

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NotificationItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
      }
    } catch (e) {
      console.warn("NotificationContext: load failed", e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, unread: false } : x));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((x) => ({ ...x, unread: false }));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) =>
        x.id === id ? { ...x, unread: !x.unread } : x
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    let stored: NotificationItem[];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as NotificationItem[]) : [...DEFAULT_ITEMS];
      if (!Array.isArray(stored) || stored.length === 0) stored = [...DEFAULT_ITEMS];
    } catch {
      stored = [...DEFAULT_ITEMS];
    }
    const now = new Date();
    const t = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const next: NotificationItem[] = [
      { id: `r-${Date.now()}`, text: "通知を再取得しました", time: t, unread: false },
      ...stored.slice(0, 19),
    ];
    setItems(next);
    setLastRefreshedAt(now);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value: NotificationContextValue = {
    items,
    unreadCount,
    markRead,
    markAllRead,
    toggleRead,
    refresh,
    lastRefreshedAt,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
