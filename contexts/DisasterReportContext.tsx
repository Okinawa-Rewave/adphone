/**
 * DisasterReportContext
 *
 * - 投稿モーダル（CreatePostModal）が submitReport() を呼ぶ
 * - マップ画面（map/index.tsx）が disasterEvents を読む
 * - エンジン（trustMapEngine）はシングルトンを共有
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ScoredEvent, Category } from '../trustmap-scoring/src/index';
import type { DisasterType } from './NotificationContext';
import type { DamageLevel } from '../constants/BuildingDamage';
import { trustMapEngine } from '../lib/trustmap';

// ── DisasterType → Category マッピング ──────────────────
const TYPE_TO_CATEGORY: Record<DisasterType, Category> = {
  earthquake: 'danger',
  flood:      'flood',
  fire:       'fire',
  collapse:   'building_collapse',
  landslide:  'landslide',
  other:      'danger',
};

// ── DamageLevel → severity マッピング ───────────────────
function levelToSeverity(level: DamageLevel): 1 | 2 | 3 | 4 | 5 {
  if (level === 'Lv1') return 2; // 軽微
  if (level === 'Lv2') return 3; // 半壊
  if (level === 'Lv3') return 5; // 全壊
  return 3; // manual / null → 中程度
}

// ── 投稿パラメータ型 ─────────────────────────────────────
export type SubmitReportParams = {
  disasterType: DisasterType;
  damageLevel:  DamageLevel;
  lat:          number | null;
  lon:          number | null;
  text:         string;
};

// ── Context 型 ───────────────────────────────────────────
type DisasterReportContextValue = {
  disasterEvents: ScoredEvent[];
  submitReport:   (params: SubmitReportParams) => void;
  refreshScores:  () => void;
};

const DisasterReportContext = createContext<DisasterReportContextValue | null>(null);

export function DisasterReportProvider({ children }: { children: React.ReactNode }) {
  const [disasterEvents, setDisasterEvents] = useState<ScoredEvent[]>([]);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 5秒ごとに再計算（スコアの時間減衰を反映）
  useEffect(() => {
    const refresh = () => {
      const events = trustMapEngine.computeScores(0, 0);
      setDisasterEvents(events);
    };
    refresh(); // 初回即時
    refreshRef.current = setInterval(refresh, 5000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []);

  const refreshScores = () => {
    const events = trustMapEngine.computeScores(0, 0);
    setDisasterEvents(events);
  };

  const submitReport = (params: SubmitReportParams) => {
    if (params.lat === null || params.lon === null) return;

    trustMapEngine.recordObservation(
      {
        category:   TYPE_TO_CATEGORY[params.disasterType],
        severity:   levelToSeverity(params.damageLevel),
        lat:        params.lat,
        lng:        params.lon,
        issuerType: 0,
        pubkey:     'local',
        signature:  'sig',
        note:       params.text.trim() || undefined,
      },
      'sig'
    );

    refreshScores();
  };

  return (
    <DisasterReportContext.Provider value={{ disasterEvents, submitReport, refreshScores }}>
      {children}
    </DisasterReportContext.Provider>
  );
}

export function useDisasterReport() {
  const ctx = useContext(DisasterReportContext);
  if (!ctx) throw new Error('useDisasterReport must be used inside DisasterReportProvider');
  return ctx;
}
