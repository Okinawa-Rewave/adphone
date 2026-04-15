/**
 * DisasterReportContext
 *
 * - 投稿モーダル（CreatePostModal）が submitReport() を呼ぶ
 * - マップ画面（map/index.tsx）が disasterEvents を読む
 * - エンジン（trustMapEngine）はシングルトンを共有
 * - 投稿済み PostPayload を AsyncStorage に永続化し、アプリ再起動時に復元
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScoredEvent } from '../trustmap-scoring/src/index';
import { trustMapEngine } from '../lib/trustmap';
import { payloadToRawPacket } from '../lib/postToPacket';
import type { PostPayload } from '../lib/postPayload';

const STORAGE_KEY = '@disaster_payloads_v1';
const MAX_STORED = 200;

// ── Context 型 ───────────────────────────────────────────
type DisasterReportContextValue = {
  disasterEvents: ScoredEvent[];
  submitReport:   (payload: PostPayload) => void;
  ingestPacket:   (payload: PostPayload) => Promise<void>;
  refreshScores:  () => void;
};

const DisasterReportContext = createContext<DisasterReportContextValue | null>(null);

export function DisasterReportProvider({ children }: { children: React.ReactNode }) {
  const [disasterEvents, setDisasterEvents] = useState<ScoredEvent[]>([]);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storedPayloadsRef = useRef<PostPayload[]>([]);

  const refreshScores = () => {
    const events = trustMapEngine.computeScores(0, 0);
    setDisasterEvents(events);
  };

  const persistPayload = (payload: PostPayload) => {
    if (payload.lat == null || payload.lon == null) return;
    storedPayloadsRef.current = [payload, ...storedPayloadsRef.current].slice(0, MAX_STORED);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedPayloadsRef.current)).catch(() => {});
  };

  // 起動時: AsyncStorage から保存済みペイロードを復元して TrustMap に投入
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const payloads = JSON.parse(raw) as PostPayload[];
          if (Array.isArray(payloads)) {
            storedPayloadsRef.current = payloads;
            for (const p of payloads) {
              const packet = payloadToRawPacket(p);
              if (packet) await trustMapEngine.onReceive(packet);
            }
            refreshScores();
          }
        }
      } catch { /* 復元失敗は非致命的 */ }
    })();
  }, []);

  // 5秒ごとに再計算（スコアの時間減衰を反映）
  useEffect(() => {
    refreshRef.current = setInterval(refreshScores, 5000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []);

  const ingestPacket = async (payload: PostPayload) => {
    const packet = payloadToRawPacket(payload);
    if (!packet) return;
    const result = await trustMapEngine.onReceive(packet);
    if (result === 'saved') {
      persistPayload(payload);
      refreshScores();
    }
  };

  const submitReport = (payload: PostPayload) => {
    const packet = payloadToRawPacket(payload);
    if (!packet) return;
    void trustMapEngine.onReceive(packet);
    persistPayload(payload);
    refreshScores();
  };

  return (
    <DisasterReportContext.Provider value={{ disasterEvents, submitReport, ingestPacket, refreshScores }}>
      {children}
    </DisasterReportContext.Provider>
  );
}

export function useDisasterReport() {
  const ctx = useContext(DisasterReportContext);
  if (!ctx) throw new Error('useDisasterReport must be used inside DisasterReportProvider');
  return ctx;
}
