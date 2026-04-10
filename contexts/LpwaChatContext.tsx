/**
 * LpwaChatContext — LPWA ブロードキャストチャットのメッセージ状態管理
 *
 * - メッセージは起動ごとにリセット（AsyncStorage には保存しない）
 * - 新着を先頭に prepend（receivedMessages と同じ順序）
 * - 重複 ID はスキップ
 * - myIdShort: Firebase UID 先頭8文字（バブルの自分判定用）
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ensureAnonAuth } from "@/lib/auth";
import type { LpwaChatMessage } from "@/lib/chatPayload";

const MAX_MESSAGES = 200;

type LpwaChatContextValue = {
  messages: LpwaChatMessage[];
  myIdShort: string;
  addMessage: (msg: LpwaChatMessage) => void;
};

const LpwaChatContext = createContext<LpwaChatContextValue | null>(null);

export function LpwaChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<LpwaChatMessage[]>([]);
  const [myIdShort, setMyIdShort] = useState("");

  useEffect(() => {
    ensureAnonAuth().then((user) => {
      if (user?.uid) setMyIdShort(user.uid.slice(0, 8));
    });
  }, []);

  const addMessage = useCallback((msg: LpwaChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [msg, ...prev].slice(0, MAX_MESSAGES);
    });
  }, []);

  return (
    <LpwaChatContext.Provider value={{ messages, myIdShort, addMessage }}>
      {children}
    </LpwaChatContext.Provider>
  );
}

export function useLpwaChat(): LpwaChatContextValue {
  const ctx = useContext(LpwaChatContext);
  if (!ctx) throw new Error("useLpwaChat must be used inside LpwaChatProvider");
  return ctx;
}
