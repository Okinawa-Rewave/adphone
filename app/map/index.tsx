import { AppBar } from '@/components/AppBar';
import { BOTTOM_TAB_HEIGHT, BottomTab } from '@/components/BottomTab';
import { MobileFrame } from '@/components/MobileFrame';
import { Design } from '@/constants/Design';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as turf from '@turf/helpers';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import nearestPointOnLineFn from '@turf/nearest-point-on-line';
import { WebView } from 'react-native-webview';


import { useOnline } from '@/hooks/useOnline';
import shelterData from '../../assets/shelters.json';
import { appendMapSaveHistory, type MapSaveHistoryItem } from '../../lib/mapSaveHistory';

// ── TrustMap（アプリ全体シングルトン）──────────────
import { useDisasterReport } from '../../contexts/DisasterReportContext';
import { trustMapEngine } from '../../lib/trustmap';
import type { RawPacket, ScoredEvent } from '../../trustmap-scoring/src/index';

// ── ダミーパケット（動作確認用・本番では削除）────
// 初期位置: 沖縄高専 (26.526711, 128.030292)
// 各クラスターは半径 20m 以内に集約 → enclosingRadius = MIN_RADIUS(50m) で単一マーカーに統合される
const NOW = Date.now() / 1000;
const DUMMY_PACKETS: RawPacket[] = [
  // けが人クラスター — 高専正門付近 (center: 26.5265, 128.0310) 全witness ±20m以内
  { id: 'inj1', category: 'injured', severity: 5, lat: 26.5267, lng: 128.0312, timestamp: NOW - 60,  issuerType: 1, pubkey: 'pk', signature: 'sig', note: '複数名が下敷き' },
  { id: 'inj2', category: 'injured', severity: 4, lat: 26.5263, lng: 128.0308, timestamp: NOW - 120, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '頭部から出血、意識あり' },
  { id: 'inj3', category: 'injured', severity: 5, lat: 26.5266, lng: 128.0308, timestamp: NOW - 150, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '重傷者3名、救急要請済み' },
  { id: 'inj4', category: 'injured', severity: 3, lat: 26.5264, lng: 128.0312, timestamp: NOW - 90,  issuerType: 0, pubkey: 'pk', signature: 'sig', note: '足の骨折の疑い' },
  { id: 'inj5', category: 'injured', severity: 4, lat: 26.5265, lng: 128.0312, timestamp: NOW - 200, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '動けない人がいる' },

  // 浸水クラスター — 辺野古川沿い (center: 26.5270, 128.0290) 全witness ±20m以内
  //{ id: 'flood1', category: 'flood', severity: 4, lat: 26.5272, lng: 128.0292, timestamp: NOW - 300, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '道路が完全に冠水' },
  //{ id: 'flood2', category: 'flood', severity: 3, lat: 26.5268, lng: 128.0288, timestamp: NOW - 250, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '膝下まで浸水' },
  //{ id: 'flood3', category: 'flood', severity: 5, lat: 26.5271, lng: 128.0288, timestamp: NOW - 400, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '川が氾濫し家屋に流入' },
  //{ id: 'flood4', category: 'flood', severity: 4, lat: 26.5269, lng: 128.0292, timestamp: NOW - 150, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '車が水没している' },

  // 火災クラスター — 辺野古市街地 (center: 26.5310, 128.0320) 全witness ±20m以内
  { id: 'fire1', category: 'fire', severity: 5, lat: 26.5312, lng: 128.0322, timestamp: NOW - 180, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '店舗から激しく出火' },
  { id: 'fire2', category: 'fire', severity: 4, lat: 26.5308, lng: 128.0318, timestamp: NOW - 100, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '隣の住宅に延焼中' },
  { id: 'fire3', category: 'fire', severity: 4, lat: 26.5311, lng: 128.0318, timestamp: NOW - 350, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '黒煙が上がり視界不良' },
  { id: 'fire4', category: 'fire', severity: 5, lat: 26.5309, lng: 128.0322, timestamp: NOW - 120, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '逃げ遅れあり、救急車要請' },

  // 道路閉塞クラスター — 高専→久辺小の直線ルート中間点 (center: 26.5234, 128.0271) 全witness ±20m以内
  // この位置が迂回を発動させる（直線ルート上に配置）
  { id: 'road1', category: 'road_block', severity: 4, lat: 26.5230, lng: 128.0273, timestamp: NOW - 450, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '土砂崩れにより全面通行止め' },
  { id: 'road2', category: 'road_block', severity: 3, lat: 26.5232, lng: 128.0279, timestamp: NOW - 500, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '倒木で車道が塞がれている' },
  { id: 'road3', category: 'road_block', severity: 4, lat: 26.5228, lng: 128.0276, timestamp: NOW - 600, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '斜面が崩落、近づかないで' },

  // 建物倒壊クラスター — 高専東側 (center: 26.5260, 128.0345) 全witness ±20m以内
  { id: 'bld1', category: 'building_collapse', severity: 5, lat: 26.5262, lng: 128.0347, timestamp: NOW - 300, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '古いアパートが全壊' },
  { id: 'bld2', category: 'building_collapse', severity: 4, lat: 26.5258, lng: 128.0343, timestamp: NOW - 150, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '倉庫の屋根が崩落' },
  { id: 'bld3', category: 'building_collapse', severity: 4, lat: 26.5260, lng: 128.0343, timestamp: NOW - 400, issuerType: 0, pubkey: 'pk', signature: 'sig', note: 'ブロック塀が倒壊し道を塞ぐ' },

  // ガス漏れクラスター — 高専北側 (center: 26.5290, 128.0285) 全witness ±20m以内
  { id: 'gas1', category: 'gas_leak', severity: 4, lat: 26.5292, lng: 128.0287, timestamp: NOW - 100, issuerType: 1, pubkey: 'pk', signature: 'sig', note: 'ガス臭が充満している' },
  { id: 'gas2', category: 'gas_leak', severity: 3, lat: 26.5288, lng: 128.0283, timestamp: NOW - 250, issuerType: 0, pubkey: 'pk', signature: 'sig', note: 'シューという音がする' },
  //{ id: 'gas3', category: 'road_block', severity: 3, lat: 26.5247, lng:128.0312513, timestamp: NOW - 300, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '異臭が広範囲に漂っている' }

  // ── 渋谷ヒカリエ周辺ダミー ────────────────────────────────────────
  // けが人クラスター — ヒカリエホール正面玄関前 (center: 35.6590, 139.7031) ±12m以内
  { id: 'shib_inj1', category: 'injured', severity: 5, lat: 35.6591, lng: 139.7032, timestamp: NOW - 80,  issuerType: 1, pubkey: 'pk', signature: 'sig', note: 'イベント会場前で群衆が将棋倒し、複数名が重傷' },
  { id: 'shib_inj2', category: 'injured', severity: 4, lat: 35.6589, lng: 139.7030, timestamp: NOW - 140, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '転倒した高齢者が動けない状態、救急要請済み' },
  { id: 'shib_inj3', category: 'injured', severity: 5, lat: 35.6591, lng: 139.7030, timestamp: NOW - 200, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '出血あり、意識不明の傷病者が3名' },
  { id: 'shib_inj4', category: 'injured', severity: 3, lat: 35.6589, lng: 139.7032, timestamp: NOW - 60,  issuerType: 0, pubkey: 'pk', signature: 'sig', note: '足を挟まれた人がいる、急いで' },

  // 火災クラスター — ヒカリエ東側商業ビル (center: 35.6585, 139.7097) ±12m以内
  { id: 'shib_fire1', category: 'fire', severity: 5, lat: 35.6586, lng: 139.7098, timestamp: NOW - 160, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '飲食店から出火、隣接テナントへ延焼中' },
  { id: 'shib_fire2', category: 'fire', severity: 4, lat: 35.6584, lng: 139.7096, timestamp: NOW - 110, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '黒煙が3階から噴出、避難誘導中' },
  { id: 'shib_fire3', category: 'fire', severity: 4, lat: 35.6586, lng: 139.7096, timestamp: NOW - 300, issuerType: 0, pubkey: 'pk', signature: 'sig', note: 'スプリンクラー作動せず、消防車到着待ち' },
  { id: 'shib_fire4', category: 'fire', severity: 5, lat: 35.6584, lng: 139.7098, timestamp: NOW - 90,  issuerType: 1, pubkey: 'pk', signature: 'sig', note: '逃げ遅れあり、エレベーター使用禁止を周知してください' },

  // 浸水クラスター — 渋谷川暗渠・ヒカリエ南側 (center: 35.6573, 139.7035) ±12m以内
  { id: 'shib_flood1', category: 'flood', severity: 4, lat: 35.6574, lng: 139.7036, timestamp: NOW - 320, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '渋谷川が溢水、地下への流入を確認' },
  { id: 'shib_flood2', category: 'flood', severity: 3, lat: 35.6572, lng: 139.7034, timestamp: NOW - 270, issuerType: 0, pubkey: 'pk', signature: 'sig', note: '歩道が膝下まで浸水、通行困難' },
  { id: 'shib_flood3', category: 'flood', severity: 5, lat: 35.6574, lng: 139.7034, timestamp: NOW - 420, issuerType: 1, pubkey: 'pk', signature: 'sig', note: '地下駐車場への浸水急速進行、車両移動を' },
];

const SELF_ID = 'userA';
type Mode = 'walk' | 'car';

// 操作ガイドの表示状態を保存するキー（一度閉じたら再表示しない）
const MAP_GUIDE_DISMISSED_KEY = '@map_guide_dismissed';
// 音声案内・大文字モードの設定保存キー
const VOICE_ON_KEY   = '@map_voice_on';
const LARGE_TEXT_KEY = '@map_large_text';

// #4: ルートからこの距離(m)以上外れたら再探索する
const REROUTE_DEVIATION_M = 30;
// #11: 目的地にこの距離(m)まで近づいたら「到着」とみなす
const ARRIVAL_RADIUS_M = 25;

// 移動速度の目安（m/分）: 徒歩 4.8km/h ≒ 80、車 30km/h ≒ 500
const SPEED_M_PER_MIN: Record<Mode, number> = { walk: 80, car: 500 };

// 災害カテゴリの日本語ラベル（圏内警告の表示用）
const CATEGORY_LABEL_JP: Record<string, string> = {
  flood:             '浸水・洪水',
  tsunami:           '津波',
  fire:              '火災',
  gas_leak:          'ガス漏れ',
  building_collapse: 'ビル倒壊',
  landslide:         '土砂崩れ',
  road_block:        '道路閉鎖',
  danger:            'その他危険',
};

// 距離(m)とモードから所要時間の目安テキストを返す
function formatEta(distanceM: number, mode: Mode): string {
  const min = Math.max(1, Math.round(distanceM / SPEED_M_PER_MIN[mode]));
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  }
  return `約${min}分`;
}

type UserPos     = { id: string; lat: number; lng: number };
type Destination = { lat: number; lng: number; name: string; isShelter: boolean };

// ── フィルタの型 ──────────────────────────────────
type FilterKey = 'disasters' | 'shelters' | 'injured';
type FilterState = Record<FilterKey, boolean>;

type DangerEvent = ScoredEvent & { enclosingRadiusM: number };

const ROUTE_AVOID_MARGIN = 30;
const SAFE_CLIP_PAD      = 0.03; // ~3.3km: 安全迂回用bbox（広げすぎるとA*が遅くなる）
const NORMAL_CLIP_PAD    = 0.02; // ~2.2km: 通常ルート・ペナルティ用
const MAX_CASCADE           = 5;  // 手動目的地カスケードの最大試行数
const MAX_SHELTER_CANDIDATES = 8; // 自動避難所探索: A*で比較する候補数

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 点→線分の最短距離 (m)。局所平面近似（cosLat補正）を使用。
function minDistFromPointToSegmentM(
  clat: number, clng: number,
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const cosLat = Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const cx = (clng - lng1) * cosLat * R * Math.PI / 180;
  const cy = (clat - lat1) * R * Math.PI / 180;
  const ex = (lng2 - lng1) * cosLat * R * Math.PI / 180;
  const ey = (lat2 - lat1) * R * Math.PI / 180;
  const len2 = ex * ex + ey * ey;
  if (len2 === 0) return Math.sqrt(cx * cx + cy * cy);
  const t = Math.max(0, Math.min(1, (cx * ex + cy * ey) / len2));
  const dx = cx - t * ex;
  const dy = cy - t * ey;
  return Math.sqrt(dx * dx + dy * dy);
}

// #4: 現在地から確定ルート（[lat,lng]の配列）までの最短距離(m)
function distanceFromPath(pos: { lat: number; lng: number }, path: [number, number][]): number {
  if (path.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [lat1, lng1] = path[i];
    const [lat2, lng2] = path[i + 1];
    const d = minDistFromPointToSegmentM(pos.lat, pos.lng, lat1, lng1, lat2, lng2);
    if (d < min) min = d;
  }
  return min;
}

// スナップ後の始点・終点が危険圏内に入るエッジケースも含め、確定経路の貫通を検出する
function pathPenetratesDanger(
  path: [number, number][],  // [lng, lat][]
  dangers: DangerEvent[],
  margin: number,
): { penetrated: boolean; hitDangers: DangerEvent[] } {
  const hits = new Set<DangerEvent>();
  for (let i = 0; i < path.length - 1; i++) {
    const [lng1, lat1] = path[i];
    const [lng2, lat2] = path[i + 1];
    for (const d of dangers) {
      if (hits.has(d)) continue;
      if (minDistFromPointToSegmentM(
        d.lat, d.lng, lat1, lng1, lat2, lng2,
      ) <= d.enclosingRadiusM + margin) {
        hits.add(d);
      }
    }
  }
  return { penetrated: hits.size > 0, hitDangers: Array.from(hits) };
}

function nearestPointOnRoads(point: any, lineFeatures: any[]) {
  if (!lineFeatures.length) return point;
  let nearest = nearestPointOnLineFn(lineFeatures[0], point) as any;
  let minDist = Number(nearest?.properties?.dist ?? Infinity);
  for (let i = 1; i < lineFeatures.length; i++) {
    const candidate = nearestPointOnLineFn(lineFeatures[i], point) as any;
    const d = Number(candidate?.properties?.dist ?? Infinity);
    if (d < minDist) {
      minDist = d;
      nearest = candidate;
    }
  }
  return nearest;
}

function clipToBbox(features: any[], lat1: number, lng1: number, lat2: number, lng2: number, pad = 0.05): any[] {
  const minLat = Math.min(lat1, lat2) - pad;
  const maxLat = Math.max(lat1, lat2) + pad;
  const minLng = Math.min(lng1, lng2) - pad;
  const maxLng = Math.max(lng1, lng2) + pad;
  return features.filter((f: any) => {
    const coords = f.geometry.coordinates as number[][];
    return coords.some(([lng, lat]) =>
      lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
    );
  });
}

function calcEnclosingRadiusM(
  witnessCoords: { lat: number; lng: number }[],
  centerLat: number,
  centerLng: number
): number {
  const MIN_RADIUS = 50;
  const MAX_RADIUS = 200;
  if (!witnessCoords || witnessCoords.length <= 1) return MIN_RADIUS;
  let maxDist = 0;
  for (const w of witnessCoords) {
    const d = distanceM(centerLat, centerLng, w.lat, w.lng);
    if (d > maxDist) maxDist = d;
  }
  return Math.max(MIN_RADIUS, Math.min(maxDist, MAX_RADIUS));
}

// 現在地から安全に到達できる避難所を距離順で返す（危険エリア内にある避難所は除外）
function buildShelterCandidates(start: UserPos, dangers: DangerEvent[]): any[] {
  let candidates: { shelter: any; score: number }[] = [];
  for (const s of shelterData as any[]) {
    const insideDanger = dangers.some(
      dz => distanceM(s.lat, s.lng, dz.lat, dz.lng) <= dz.enclosingRadiusM + ROUTE_AVOID_MARGIN
    );
    if (insideDanger) continue;
    const d = distanceM(start.lat, start.lng, s.lat, s.lng);
    let penalty = 1.0;
    for (const dz of dangers) {
      if (minDistFromPointToSegmentM(
        dz.lat, dz.lng, start.lat, start.lng, s.lat, s.lng,
      ) <= dz.enclosingRadiusM + ROUTE_AVOID_MARGIN) {
        penalty = 100.0;
        break;
      }
    }
    candidates.push({ shelter: s, score: d * penalty });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length === 0) {
    for (const s of shelterData as any[]) {
      candidates.push({ shelter: s, score: distanceM(start.lat, start.lng, s.lat, s.lng) });
    }
    candidates.sort((a, b) => a.score - b.score);
  }
  return candidates.map(c => c.shelter);
}

// ── A* Pathfinding ──────────────────────────────────
interface AStarEdge { toKey: string; toLng: number; toLat: number; dist: number }
type AStarGraph = Map<string, AStarEdge[]>

class MinHeap {
  private d: [number, string][] = []
  push(f: number, k: string) {
    this.d.push([f, k])
    let i = this.d.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.d[p][0] <= this.d[i][0]) break
      ;[this.d[p], this.d[i]] = [this.d[i], this.d[p]]
      i = p
    }
  }
  pop(): [number, string] | undefined {
    if (!this.d.length) return undefined
    const top = this.d[0]
    const last = this.d.pop()!
    if (this.d.length) {
      this.d[0] = last
      let i = 0
      const n = this.d.length
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2
        let s = i
        if (l < n && this.d[l][0] < this.d[s][0]) s = l
        if (r < n && this.d[r][0] < this.d[s][0]) s = r
        if (s === i) break
        ;[this.d[s], this.d[i]] = [this.d[i], this.d[s]]
        i = s
      }
    }
    return top
  }
  get size() { return this.d.length }
}

function nk(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`
}

function buildGraph(
  features: any[],
  dangers?: DangerEvent[],
  margin?: number,
): { graph: AStarGraph; removedAny: boolean } {
  const g: AStarGraph = new Map()
  let removedAny = false
  for (const f of features) {
    if (f.geometry?.type !== 'LineString') continue
    const c: number[][] = f.geometry.coordinates
    for (let i = 0; i < c.length - 1; i++) {
      const [lng1, lat1] = c[i], [lng2, lat2] = c[i + 1]
      if (dangers && margin != null) {
        let blocked = false
        for (const d of dangers) {
          if (minDistFromPointToSegmentM(
            d.lat, d.lng, lat1, lng1, lat2, lng2,
          ) <= d.enclosingRadiusM + margin) {
            blocked = true; removedAny = true; break
          }
        }
        if (blocked) continue
      }
      const k1 = nk(lng1, lat1), k2 = nk(lng2, lat2)
      const dist = distanceM(lat1, lng1, lat2, lng2)
      if (!g.has(k1)) g.set(k1, [])
      if (!g.has(k2)) g.set(k2, [])
      g.get(k1)!.push({ toKey: k2, toLng: lng2, toLat: lat2, dist })
      g.get(k2)!.push({ toKey: k1, toLng: lng1, toLat: lat1, dist })
    }
  }
  return { graph: g, removedAny }
}

// 危険エッジのコストを50倍にし、グラフを非連結にせず安全経路を優先する
const DANGER_PENALTY = 50

function buildPenalizedGraph(
  features: any[],
  dangers: DangerEvent[],
  margin: number,
): AStarGraph {
  const g: AStarGraph = new Map()
  for (const f of features) {
    if (f.geometry?.type !== 'LineString') continue
    const c: number[][] = f.geometry.coordinates
    for (let i = 0; i < c.length - 1; i++) {
      const [lng1, lat1] = c[i], [lng2, lat2] = c[i + 1]
      let dist = distanceM(lat1, lng1, lat2, lng2)
      for (const d of dangers) {
        if (minDistFromPointToSegmentM(
          d.lat, d.lng, lat1, lng1, lat2, lng2,
        ) <= d.enclosingRadiusM + margin) {
          dist *= DANGER_PENALTY
          break
        }
      }
      const k1 = nk(lng1, lat1), k2 = nk(lng2, lat2)
      if (!g.has(k1)) g.set(k1, [])
      if (!g.has(k2)) g.set(k2, [])
      g.get(k1)!.push({ toKey: k2, toLng: lng2, toLat: lat2, dist })
      g.get(k2)!.push({ toKey: k1, toLng: lng1, toLat: lat1, dist })
    }
  }
  return g
}

function runAStar(
  graph: AStarGraph,
  startLng: number, startLat: number,
  endLng: number, endLat: number,
): [number, number][] | null {
  const sk = nk(startLng, startLat)
  const ek = nk(endLng, endLat)
  if (!graph.has(sk) || !graph.has(ek)) return null

  const heap = new MinHeap()
  const gScore = new Map<string, number>()
  const came = new Map<string, string | null>()
  const pos = new Map<string, [number, number]>()
  const visited = new Set<string>()

  pos.set(sk, [startLng, startLat])
  pos.set(ek, [endLng, endLat])
  gScore.set(sk, 0)
  came.set(sk, null)
  heap.push(distanceM(startLat, startLng, endLat, endLng), sk)

  while (heap.size > 0) {
    const item = heap.pop()!
    const cur = item[1]
    if (visited.has(cur)) continue
    visited.add(cur)

    if (cur === ek) {
      const path: [number, number][] = []
      let k: string | null | undefined = cur
      while (k != null) {
        const p = pos.get(k)!
        path.unshift([p[0], p[1]])
        k = came.get(k) ?? undefined
      }
      return path
    }

    const cg = gScore.get(cur) ?? Infinity
    for (const e of (graph.get(cur) ?? [])) {
      if (visited.has(e.toKey)) continue
      if (!pos.has(e.toKey)) pos.set(e.toKey, [e.toLng, e.toLat])
      const tg = cg + e.dist
      if (tg < (gScore.get(e.toKey) ?? Infinity)) {
        gScore.set(e.toKey, tg)
        came.set(e.toKey, cur)
        heap.push(tg + distanceM(e.toLat, e.toLng, endLat, endLng), e.toKey)
      }
    }
  }
  return null
}

const PENDING_DL_KEY = '@map_pending_dl';

export default function App() {
  const router = useRouter();
  const { lat: paramLat, lng: paramLng, zoom: paramZoom } = useLocalSearchParams<{
    lat?: string; lng?: string; zoom?: string;
  }>();
  const webViewRef = useRef<WebView>(null);

  const [mode, setMode]         = useState<Mode>('walk');
  const [webReady, setWebReady] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isAvoidingDisaster, setIsAvoidingDisaster] = useState(false);

  const walkLoadedRef = useRef(false);
  const carLoadedRef  = useRef(false);
  // クリップ済みルートグラフのキャッシュ（bbox × mode）
  const routeGraphCacheRef = useRef<{ key: string; graph: AStarGraph; nodes: number[][] } | null>(null);
  const walkNodesRef  = useRef<number[][]>([]);
  const carNodesRef   = useRef<number[][]>([]);
  const walkExplodedRef = useRef<any[]>([]);
  const carExplodedRef  = useRef<any[]>([]);
  const initialCenteredRef = useRef(false);
  const walkInitPromiseRef = useRef<Promise<boolean> | null>(null);
  const carInitPromiseRef  = useRef<Promise<boolean> | null>(null);
  const roadFeaturesRef = useRef<any[]>([]);
  const sentDisasterHashesRef = useRef<Record<string, string>>({});
  const latestUserPosRef = useRef<UserPos | null>(null);
  const disasterEventsRef = useRef<ScoredEvent[]>([]);
  const disasterEventsEnrichedRef = useRef<DangerEvent[]>([]);
  const isRoutingRef = useRef(false);
  const lastRouteKeyRef = useRef<string>('');
  const lastDisasterHashRef = useRef<string>('');
  const lastAlertKeyRef = useRef<string>('');
  const lastAlertAtRef = useRef<number>(0);
  const lastShelterTapAtRef = useRef<number>(0);

  const [userPos,    setUserPos]    = useState<UserPos | null>(null);
  const [locError,   setLocError]   = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  const [destination,        setDestination]        = useState<Destination | null>(null);
  const [pendingDestination, setPendingDestination] = useState<Destination | null>(null);
  const { disasterEvents, refreshScores } = useDisasterReport();
  const [showMapGuide, setShowMapGuide] = useState(false);
  const [cascadeDestName, setCascadeDestName] = useState<string | null>(null);

  // #4: フォロー（追従）モード
  const [followMode, setFollowMode] = useState(false);
  const currentRoutePathRef = useRef<[number, number][]>([]); // 確定ルート [lat,lng][]
  const lastRoutedTargetRef = useRef<string>('');             // 最後に経路探索した目的地+モード
  const routedDestRef = useRef<Destination | null>(null);     // 実際に到達対象となった地点

  // #9: 避難所リスト
  const [showShelterList, setShowShelterList] = useState(false);
  const [shelterQuery, setShelterQuery] = useState('');

  // #11: 音声案内・大文字モード
  const [voiceOn, setVoiceOn]     = useState(true);
  const [largeText, setLargeText] = useState(false);
  const voiceOnRef = useRef(voiceOn);
  const prevInsideDangerRef = useRef(false);
  const arrivedRef = useRef(false);
  const lastAnnouncedRef = useRef<string>('');

  // ── オフラインタイルDL進捗（pending DL含む）────────
  const [dlProgress, setDlProgress] = useState(0);
  const [dlTotal,    setDlTotal]    = useState(0);
  const [dlActive,   setDlActive]   = useState(false);

  const { isOnline } = useOnline();

  // ── フィルタ状態 ──────────────────────────────────
  const [filter, setFilter] = useState<FilterState>({
    disasters: true,
    shelters:  true,
    injured:   true,
  });

  // ── 道路ネットワーク構築 ──────────────────────────
  function explodeMultiLineStrings(features: any[]) {
    const out: any[] = [];
    features.forEach((f) => {
      if (!f.geometry) return;
      if (f.geometry.type === 'LineString') {
        out.push(f);
      } else if (f.geometry.type === 'MultiLineString') {
        f.geometry.coordinates.forEach((line: any[]) => {
          out.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: line },
            properties: f.properties || {}
          });
        });
      }
    });
    return out;
  }

  function extractNodes(features: any[]) {
    const nodes: number[][] = [];
    features.forEach((f) => {
      if (!f.geometry || f.geometry.type !== 'LineString') return;
      const c = f.geometry.coordinates;
      nodes.push(c[0]);
      nodes.push(c[c.length - 1]);
    });
    return nodes;
  }

  function snapToNearestNode(point: any, nodes: number[][]) {
    let min = Infinity;
    let nearest = nodes[0];
    nodes.forEach((n) => {
      const dx = point.geometry.coordinates[0] - n[0];
      const dy = point.geometry.coordinates[1] - n[1];
      const d = dx * dx + dy * dy;
      if (d < min) { min = d; nearest = n; }
    });
    return turf.point(nearest);
  }

  // ── 現在地: GPS取得 ──
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('位置情報の権限がありません');
        setLocLoading(false);
        return;
      }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserPos({ id: SELF_ID, lat: initial.coords.latitude, lng: initial.coords.longitude });
      setLocLoading(false);
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setUserPos({ id: SELF_ID, lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      );
    })();
    return () => { subscription?.remove(); };
  }, []);

  // ── 操作ガイド: 未閉じならマウント時に1度だけ表示 ──
  useEffect(() => {
    AsyncStorage.getItem(MAP_GUIDE_DISMISSED_KEY).then((v) => {
      if (v !== '1') setShowMapGuide(true);
    }).catch(() => setShowMapGuide(true));
  }, []);

  const handleDismissGuide = useCallback(() => {
    setShowMapGuide(false);
    void AsyncStorage.setItem(MAP_GUIDE_DISMISSED_KEY, '1');
  }, []);

  // ── #11: 音声/大文字の設定を読み込み ──
  useEffect(() => {
    AsyncStorage.multiGet([VOICE_ON_KEY, LARGE_TEXT_KEY]).then((pairs) => {
      const map = Object.fromEntries(pairs);
      if (map[VOICE_ON_KEY] === '0') setVoiceOn(false);
      if (map[LARGE_TEXT_KEY] === '1') setLargeText(true);
    }).catch(() => {});
  }, []);

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  // ── #11: 日本語で読み上げ（音声OFF時は無音）──
  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current) return;
    try {
      Speech.stop();
      Speech.speak(text, { language: 'ja-JP' });
    } catch { /* TTS未対応端末は無視 */ }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceOn((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(VOICE_ON_KEY, next ? '1' : '0');
      if (!next) { try { Speech.stop(); } catch {} }
      return next;
    });
  }, []);

  const toggleLargeText = useCallback(() => {
    setLargeText((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(LARGE_TEXT_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const ensureRoutingReady = useCallback(async (targetMode: Mode): Promise<boolean> => {
    const readyForMode = targetMode === 'walk' ? walkLoadedRef.current : carLoadedRef.current;
    if (readyForMode) return true;
    const initRef = targetMode === 'walk' ? walkInitPromiseRef : carInitPromiseRef;
    if (initRef.current) return initRef.current;
    initRef.current = (async () => {
      try {
        if (!roadFeaturesRef.current.length) {
          const roadModule: any = await import('../../assets/roads_all.json');
          const roadData = roadModule?.default ?? roadModule;
          roadFeaturesRef.current = roadData?.features ?? [];
        }

        const allFeatures = roadFeaturesRef.current;
        if (targetMode === 'walk' && !walkLoadedRef.current) {
          const WALK_EXCLUDE = new Set([
            'motorway', 'motorway_link', 'service', 'track',
            'cycleway', 'bridleway', 'raceway', 'bus_guideway',
            'construction', 'proposed',
          ]);
          const walkRaw = allFeatures.filter(
            (f: any) => f.properties?.highway && !WALK_EXCLUDE.has(f.properties.highway)
          );
          walkExplodedRef.current = explodeMultiLineStrings(walkRaw);
          walkNodesRef.current = extractNodes(walkExplodedRef.current);
          walkLoadedRef.current = true;
        }
        if (targetMode === 'car' && !carLoadedRef.current) {
          const carRaw = allFeatures.filter(
            (f: any) => f.properties?.highway &&
              !['footway', 'steps', 'pedestrian'].includes(f.properties.highway)
          );
          carExplodedRef.current = explodeMultiLineStrings(carRaw);
          carNodesRef.current = extractNodes(carExplodedRef.current);
          carLoadedRef.current = true;
        }
        return true;
      } catch {
        const now = Date.now();
        if (lastAlertKeyRef.current !== 'init-fail' || now - lastAlertAtRef.current > 8000) {
          lastAlertKeyRef.current = 'init-fail';
          lastAlertAtRef.current = now;
          Alert.alert('エラー', '道路データの初期化に失敗しました');
        }
        return false;
      } finally {
        initRef.current = null;
      }
    })();
    return initRef.current;
  }, []);

  // ── disasterEventsRef を経路探索用に同期 ──
  useEffect(() => {
    disasterEventsRef.current = disasterEvents;
    disasterEventsEnrichedRef.current = disasterEvents.map(e => ({
      ...e,
      enclosingRadiusM: calcEnclosingRadiusM(
        e.packets.map(p => ({ lat: p.lat, lng: p.lng })),
        e.lat, e.lng
      ),
    }));
  }, [disasterEvents]);

  useEffect(() => {
    latestUserPosRef.current = userPos;
  }, [userPos]);

  // ── ダミーパケットを共有エンジンに投入（動作確認用・本番では削除）──
  useEffect(() => {
    (async () => {
      for (const p of DUMMY_PACKETS) {
        await trustMapEngine.onReceive(p);
      }
      refreshScores();
    })();
  }, []);

  // ── 接続状態を WebView に通知（復帰時のタイル再描画など）────────────
  useEffect(() => {
    if (!webReady) return;
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'setOnlineStatus', isOnline })
    );
  }, [webReady, isOnline]);

  // ── WebViewにユーザー位置を送信 ──────────────────
  useEffect(() => {
    if (!webReady || !userPos) return;
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'updateUsers', users: [userPos] })
    );
    if (!initialCenteredRef.current) {
      initialCenteredRef.current = true;
      webViewRef.current?.postMessage(
        JSON.stringify({ type: 'setMapView', lat: userPos.lat, lng: userPos.lng, zoom: 15 })
      );
    }
  }, [webReady, userPos]);

  // ── WebViewに災害マーカーを送信 ──────────────────
  useEffect(() => {
    if (!webReady) return;
    const nextHashes: Record<string, string> = {};
    const upserts = disasterEvents.map((e, idx) => {
      const id = `${e.category}:${e.lat.toFixed(5)}:${e.lng.toFixed(5)}:${idx}`;
      const witnessCoords = e.packets.map((p) => ({ lat: p.lat, lng: p.lng }));
      const enclosingRadiusM = calcEnclosingRadiusM(witnessCoords, e.lat, e.lng);
      const hash = [
        e.category, e.lat, e.lng, e.severity, e.score, e.stars,
        e.witnessCount, e.hasOfficial ? 1 : 0, e.packets[0]?.note ?? '', enclosingRadiusM
      ].join('|');
      nextHashes[id] = hash;
      return {
        id,
        category: e.category,
        lat: e.lat,
        lng: e.lng,
        severity: e.severity,
        score: e.score,
        stars: e.stars,
        witnessCount: e.witnessCount,
        hasOfficial: e.hasOfficial,
        note: e.packets[0]?.note ?? '',
        enclosingRadiusM,
      };
    }).filter((event) => sentDisasterHashesRef.current[event.id] !== nextHashes[event.id]);
    const removeIds = Object.keys(sentDisasterHashesRef.current).filter((id) => !(id in nextHashes));
    sentDisasterHashesRef.current = nextHashes;
    if (!upserts.length && !removeIds.length) return;
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'updateDisastersPatch', upserts, removeIds })
    );
  }, [webReady, disasterEvents]);

  // ── フィルタ変更をWebViewに送信 ──────────────────
  const handleFilter = (key: FilterKey) => {
    const newVal = !filter[key];
    setFilter((prev) => ({ ...prev, [key]: newVal }));
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'setFilter', key, value: newVal })
    );
  };

  // ── A* 経路探索（クリップ済みグラフ + 災害エリア回避）──────────────
  // disasterEventsをクロージャに含めず disasterEventsEnrichedRef.current で読むことで
  // disasterEvents変化時のコールバック再生成→useEffect連鎖を防ぐ
  const findRoute = useCallback((start: UserPos, end: Destination) => {
    const isWalk = mode === 'walk';
    const allExploded = isWalk ? walkExplodedRef.current : carExplodedRef.current;
    const allNodes    = isWalk ? walkNodesRef.current    : carNodesRef.current;
    if (!allExploded.length || !allNodes.length) {
      console.warn(`[A*] Skipped: roads not loaded, mode=${mode}`);
      return;
    }

    // 現在の災害データをrefから直接取得（staleにならない）
    const dangers = disasterEventsEnrichedRef.current.filter(e => e.category !== 'injured');
    const routePad = SAFE_CLIP_PAD;
    const bMinLat = Math.min(start.lat, end.lat) - routePad;
    const bMaxLat = Math.max(start.lat, end.lat) + routePad;
    const bMinLng = Math.min(start.lng, end.lng) - routePad;
    const bMaxLng = Math.max(start.lng, end.lng) + routePad;
    const nearbyDangers = dangers.filter(e => {
      const padLat = e.enclosingRadiusM / 111000;
      const padLng = e.enclosingRadiusM / (111000 * Math.cos(e.lat * Math.PI / 180));
      return e.lat >= bMinLat - padLat && e.lat <= bMaxLat + padLat &&
             e.lng >= bMinLng - padLng && e.lng <= bMaxLng + padLng;
    });

    // routeKey: 位置・モード・災害状態が同じなら再計算しない
    const routeKey = [
      start.lat.toFixed(5), start.lng.toFixed(5),
      end.lat.toFixed(5), end.lng.toFixed(5),
      mode,
      nearbyDangers.map(d =>
        `${d.lat.toFixed(5)},${d.lng.toFixed(5)},${d.enclosingRadiusM.toFixed(0)}`
      ).sort().join('|'),
    ].join('||');
    if (routeKey === lastRouteKeyRef.current) {
      console.log('[A*] Skipped: same routeKey');
      return;
    }
    if (isRoutingRef.current) {
      console.log('[A*] Skipped: already routing');
      return;
    }

    lastRouteKeyRef.current = routeKey;
    isRoutingRef.current = true;
    setIsRouting(true);
    const t0 = Date.now();

    setTimeout(() => {
      try {
        const isAutoShelter = (end as any)._isAutoShelterSearch === true;
        const candidates: any[] = ((end as any)._shelterCandidates ?? []).slice(0, MAX_SHELTER_CANDIDATES);

        // ── フィーチャー取得 ──────────────────────────────────────────
        // 広域（Pass 1・2: 安全迂回用）
        const safeClipped  = clipToBbox(allExploded, start.lat, start.lng, end.lat, end.lng, SAFE_CLIP_PAD);
        const safeFeatures = safeClipped.length > 50 ? safeClipped : allExploded;
        const safeNodes    = extractNodes(safeFeatures);
        // 通常（Pass 3・4・危険なし: 通常ルート用）
        const normalClipped  = clipToBbox(allExploded, start.lat, start.lng, end.lat, end.lng, NORMAL_CLIP_PAD);
        const normalFeatures = normalClipped.length > 50 ? normalClipped : allExploded;

        // 始点スナップ（全パス共通）
        const snapStart = nearestPointOnRoads(turf.point([start.lng, start.lat]), safeFeatures);
        const startNode = snapToNearestNode(snapStart, safeNodes.length > 10 ? safeNodes : allNodes);
        const [startLng, startLat] = startNode.geometry.coordinates as [number, number];

        // 終点スナップヘルパー
        function snapTo(lat: number, lng: number, features: any[], nodes: number[][]): [number, number] {
          const snap = nearestPointOnRoads(turf.point([lng, lat]), features);
          const node = snapToNearestNode(snap, nodes.length > 10 ? nodes : allNodes);
          return node.geometry.coordinates as [number, number];
        }

        let path: [number, number][] | null = null;
        let isAvoidance   = false;
        let cascadeToName: string | null = null;
        let finalDest: Destination = end;

        if (isAutoShelter) {
          // 全候補に A* を実行し、実際の道路距離が最短の避難所を選択
          const allShelterCands = [end, ...candidates];
          const autoGraph = nearbyDangers.length > 0
            ? buildGraph(safeFeatures, nearbyDangers, ROUTE_AVOID_MARGIN).graph
            : buildGraph(safeFeatures).graph;

          let bestRoadDist = Infinity;
          for (const c of allShelterCands) {
            const [cLng, cLat] = snapTo(c.lat, c.lng, safeFeatures, safeNodes);
            const p = runAStar(autoGraph, startLng, startLat, cLng, cLat);
            if (!p) continue;
            let d = 0;
            for (let i = 1; i < p.length; i++) d += distanceM(p[i - 1][1], p[i - 1][0], p[i][1], p[i][0]);
            if (d < bestRoadDist) {
              bestRoadDist = d; path = p;
              finalDest = { lat: c.lat, lng: c.lng, name: c.name, isShelter: true };
              cascadeToName = c.name !== end.name ? c.name : null;
            }
          }
          if (path) isAvoidance = nearbyDangers.length > 0;

        } else if (nearbyDangers.length > 0) {
          const { graph: safeGraph, removedAny } = buildGraph(safeFeatures, nearbyDangers, ROUTE_AVOID_MARGIN);

          // ── Pass 1: 広域安全グラフ → 元の目的地 ──────────────────────
          const [endLng1, endLat1] = snapTo(end.lat, end.lng, safeFeatures, safeNodes);
          path = runAStar(safeGraph, startLng, startLat, endLng1, endLat1);
          if (path && removedAny) isAvoidance = true;

          // ── Pass 2: 安全グラフ → 最寄り避難所カスケード（ルート不達時のみ）──
          if (!path) {
            for (const c of buildShelterCandidates(start, nearbyDangers).slice(0, MAX_CASCADE)) {
              const [cLng, cLat] = snapTo(c.lat, c.lng, safeFeatures, safeNodes);
              const candPath = runAStar(safeGraph, startLng, startLat, cLng, cLat);
              if (candPath) {
                path = candPath; isAvoidance = true;
                finalDest = { lat: c.lat, lng: c.lng, name: c.name, isShelter: true };
                cascadeToName = c.name;
                console.log(`[A*] Cascade (safe) → ${c.name}`);
                break;
              }
            }
          }

        } else {
          // 危険なし → 通常グラフで最短（グラフキャッシュ使用）
          const gKey = `${mode}|${(Math.min(start.lat, end.lat) - NORMAL_CLIP_PAD).toFixed(3)},${(Math.max(start.lat, end.lat) + NORMAL_CLIP_PAD).toFixed(3)},${(Math.min(start.lng, end.lng) - NORMAL_CLIP_PAD).toFixed(3)},${(Math.max(start.lng, end.lng) + NORMAL_CLIP_PAD).toFixed(3)}`;
          let graph: AStarGraph;
          let routeNodes: number[][];
          const cached = routeGraphCacheRef.current;
          if (cached?.key === gKey) {
            graph = cached.graph;
            routeNodes = cached.nodes;
          } else {
            graph = buildGraph(normalFeatures).graph;
            routeNodes = extractNodes(normalFeatures);
            routeGraphCacheRef.current = { key: gKey, graph, nodes: routeNodes };
            console.log(`[A*] Graph built: ${normalFeatures.length} features → ${graph.size} nodes`);
          }
          const snapNodes = routeNodes.length > 10 ? routeNodes : allNodes;
          const [endLng, endLat] = snapTo(end.lat, end.lng, normalFeatures, snapNodes);
          path = runAStar(graph, startLng, startLat, endLng, endLat);
        }

        // ── Fallback: 徒歩グラフ非連結 → 車道A* ────────────────────────
        if (!path && isWalk && carLoadedRef.current && carExplodedRef.current.length) {
          // auto-shelterは全候補を車道で試し最短を選択、手動目的地はfinalDestのみ
          const carCandidates: Destination[] = isAutoShelter
            ? [end, ...candidates].slice(0, MAX_SHELTER_CANDIDATES)
            : [finalDest];

          let bestCarDist = Infinity;
          for (const c of carCandidates) {
            const carClipped  = clipToBbox(carExplodedRef.current, start.lat, start.lng, c.lat, c.lng, NORMAL_CLIP_PAD);
            const carFeatures = carClipped.length > 50 ? carClipped : carExplodedRef.current;
            const carNodes    = extractNodes(carFeatures);
            // start/end 両方を同じ carFeatures にスナップ → グラフ内に確実にノードが存在する
            const carSnapStart = nearestPointOnRoads(turf.point([start.lng, start.lat]), carFeatures);
            const carStart     = snapToNearestNode(carSnapStart, carNodes.length > 10 ? carNodes : carNodesRef.current);
            const [csl, csa]   = carStart.geometry.coordinates as [number, number];
            const carSnapEnd  = nearestPointOnRoads(turf.point([c.lng, c.lat]), carFeatures);
            const carEnd      = snapToNearestNode(carSnapEnd, carNodes.length > 10 ? carNodes : carNodesRef.current);
            const [cel, cea]  = carEnd.geometry.coordinates as [number, number];

            let p: [number, number][] | null = null;
            if (nearbyDangers.length > 0) {
              const { graph: safeCarGraph, removedAny } = buildGraph(carFeatures, nearbyDangers, ROUTE_AVOID_MARGIN);
              p = runAStar(safeCarGraph, csl, csa, cel, cea);
              if (removedAny && p) isAvoidance = true;
            } else {
              const { graph: carGraph } = buildGraph(carFeatures);
              p = runAStar(carGraph, csl, csa, cel, cea);
            }

            if (p) {
              if (!isAutoShelter) {
                path = p;
                break;
              }
              // auto-shelter: 全候補を試して道路距離最短を選ぶ
              let d = 0;
              for (let i = 1; i < p.length; i++) d += distanceM(p[i-1][1], p[i-1][0], p[i][1], p[i][0]);
              if (d < bestCarDist) {
                bestCarDist = d; path = p;
                finalDest = { lat: c.lat, lng: c.lng, name: c.name, isShelter: true };
                cascadeToName = c.name !== end.name ? c.name : null;
              }
            }
          }
          if (path) console.log('[A*] Walk disconnected, used car network');
        }

        const elapsed = Date.now() - t0;
        if (path) {
          let trueDist = 0;
          for (let i = 0; i < path.length - 1; i++) {
            trueDist += distanceM(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0]);
          }
          const roundedDist = Math.round(trueDist);
          setDistance(roundedDist);
          setIsAvoidingDisaster(isAvoidance);
          setCascadeDestName(cascadeToName);

          // #4: 確定ルートと到達地点を保持（逸脱判定・到着判定で使用）
          const coords = path.map(([lng, lat]) => [lat, lng]) as [number, number][];
          currentRoutePathRef.current = coords;
          routedDestRef.current = finalDest;
          arrivedRef.current = false;

          // #11: 新しい目的地のときだけ案内を読み上げ（再探索では繰り返さない）
          const announceKey = `${finalDest.lat.toFixed(5)},${finalDest.lng.toFixed(5)}`;
          if (announceKey !== lastAnnouncedRef.current) {
            lastAnnouncedRef.current = announceKey;
            const distSpoken = roundedDist >= 1000
              ? `${(roundedDist / 1000).toFixed(1)}キロメートル`
              : `${roundedDist}メートル`;
            speak(
              `${finalDest.name}まで${formatEta(roundedDist, mode)}、${distSpoken}。` +
              (isAvoidance ? '災害を回避するルートです。' : '') +
              '案内を開始します'
            );
          }

          // デバッグ用アサーション（安全グラフのみ使用しているため通常は発生しない）
          if (__DEV__ && nearbyDangers.length > 0) {
            const verify = pathPenetratesDanger(path, nearbyDangers, ROUTE_AVOID_MARGIN);
            if (verify.penetrated) console.error('[A*] BUG: path still penetrates danger zone');
          }

          webViewRef.current?.postMessage(JSON.stringify({
            type: 'drawRoute', coordinates: coords, isAvoidance,
            penetrated: false, penetratedSummary: '',
          }));
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'updateDestinationPin',
            lat: finalDest.lat, lng: finalDest.lng,
            name: finalDest.name, isShelter: finalDest.isShelter,
          }));
          console.log(`[A*] OK in ${elapsed}ms, avoidance=${isAvoidance}, cascade=${cascadeToName ?? 'none'}, nodes=${path.length}`);
        } else {
          setDistance(null);
          setIsAvoidingDisaster(false);
          setCascadeDestName(null);
          const alertKey = 'no-route';
          const now = Date.now();
          if (lastAlertKeyRef.current !== alertKey || now - lastAlertAtRef.current > 8000) {
            lastAlertKeyRef.current = alertKey;
            lastAlertAtRef.current = now;
            Alert.alert(
              '安全な経路が見つかりません',
              '危険エリアを回避できる経路がありません。緊急時は119・110へ連絡してください。'
            );
          }
          console.log(`[A*] No path found (${elapsed}ms)`);
        }
      } catch (err) {
        console.error('[A*] Routing Error:', err);
      } finally {
        isRoutingRef.current = false;
        setIsRouting(false);
      }
    }, 10);
  }, [mode, speak]); // disasterEventsを依存から外す: refで読むため再生成不要

  // 目的地・モード・現在地・WebView準備が変わったとき: 経路探索
  // #4: 同じ目的地・モードで現在地だけ動いた場合は、ルートを一定以上外れたときのみ再探索
  //     （毎GPSステップの再計算を防ぎ、電池・CPUを節約）
  useEffect(() => {
    if (!webReady || !destination || !userPos) return;

    const targetKey = `${destination.lat},${destination.lng},${destination.name}|${mode}`;
    const sameTarget = targetKey === lastRoutedTargetRef.current;
    if (sameTarget && currentRoutePathRef.current.length > 1) {
      const dev = distanceFromPath(userPos, currentRoutePathRef.current);
      if (dev <= REROUTE_DEVIATION_M) return; // ルート上を移動中 → 再探索不要
      speak('ルートを外れました。経路を再検索します');
    }
    lastRoutedTargetRef.current = targetKey;

    lastRouteKeyRef.current = '';
    setCascadeDestName(null);
    const t0 = Date.now();
    (async () => {
      // walkとcarを両方ロードしてからfindRouteを呼ぶ（car fallback即時使用のため）
      const [ok] = await Promise.all([
        ensureRoutingReady(mode),
        ensureRoutingReady(mode === 'walk' ? 'car' : 'walk'),
      ]);
      if (!ok) return;
      const initElapsed = Date.now() - t0;
      if (initElapsed > 5000) console.warn(`[Route] Init took ${initElapsed}ms (>5s target)`);
      findRoute(userPos, destination);
    })();
  }, [webReady, mode, destination, userPos, findRoute, ensureRoutingReady, speak]);

  // 災害情報が更新されたとき: 実データが変化した場合のみ再探索
  useEffect(() => {
    // 位置・半径ベースのハッシュで実変化を判定（配列参照変化だけでは再計算しない）
    const hash = disasterEvents
      .filter(e => e.category !== 'injured')
      .map(e => `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`)
      .sort().join('|');
    if (hash === lastDisasterHashRef.current) return;
    lastDisasterHashRef.current = hash;

    if (!webReady || !destination || !userPos) return;
    if (!lastRouteKeyRef.current) return; // まだルート未計算なら不要
    lastRouteKeyRef.current = '';
    findRoute(userPos, destination);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disasterEvents]);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'userPanned') {
        // ユーザーが手で地図を動かしたらフォローを解除
        setFollowMode(false);
        return;
      }
      if (data.type === 'mapTap') {
        if (Date.now() - lastShelterTapAtRef.current < 400) return;
        setPendingDestination({ lat: data.lat, lng: data.lng, name: '選択した地点', isShelter: false });
        webViewRef.current?.postMessage(JSON.stringify({ type: 'setPendingPin', lat: data.lat, lng: data.lng }));
      }
      if (data.type === 'shelterTap') {
        lastShelterTapAtRef.current = Date.now();
        setPendingDestination({ lat: data.lat, lng: data.lng, name: data.name, isShelter: true });
        webViewRef.current?.postMessage(JSON.stringify({ type: 'setPendingPin', lat: data.lat, lng: data.lng }));
      }
      if (data.type === 'mapSaveEvent' && data.event) {
        if (data.event.status === 'started') return;
        const saveEvent: MapSaveHistoryItem = {
          id: String(data.event.id || `${Date.now()}`),
          status: data.event.status,
          savedTiles: typeof data.event.savedTiles === 'number' ? data.event.savedTiles : undefined,
          message: data.event.message || '',
          savedAt: data.event.savedAt || new Date().toISOString(),
          centerLat: typeof data.event.centerLat === 'number' ? data.event.centerLat : undefined,
          centerLng: typeof data.event.centerLng === 'number' ? data.event.centerLng : undefined,
          zoom: typeof data.event.zoom === 'number' ? data.event.zoom : undefined,
        };
        void appendMapSaveHistory(saveEvent);
      }
      if (data.type === 'tileStats') {
        if (data.count === 0) {
          setDlActive(false);
        }
      }
      if (data.type === 'downloadProgress') {
        setDlActive(true);
        setDlProgress(data.done);
        setDlTotal(data.total);
      }
      if (data.type === 'downloadComplete') {
        setDlActive(false);
        setDlProgress(data.total);
        setDlTotal(data.total);
      }
    } catch (e) {
      console.error('Message Parse Error:', e);
    }
  };

  const handleNearestShelter = (targetMode: Mode) => {
    if (!userPos) return;
    setMode(targetMode);
    const dangers = disasterEventsEnrichedRef.current.filter(e => e.category !== 'injured');

    // 危険ゾーン内の避難所を除外し、直線距離で昇順ソート
    let sorted = (shelterData as any[])
      .filter(s => !dangers.some(dz => distanceM(s.lat, s.lng, dz.lat, dz.lng) <= dz.enclosingRadiusM + ROUTE_AVOID_MARGIN))
      .map(s => ({ shelter: s, dist: distanceM(userPos.lat, userPos.lng, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist);

    // 全避難所が危険ゾーン内の場合はフォールバック
    if (sorted.length === 0) {
      sorted = (shelterData as any[])
        .map(s => ({ shelter: s, dist: distanceM(userPos.lat, userPos.lng, s.lat, s.lng) }))
        .sort((a, b) => a.dist - b.dist);
    }

    const top = sorted.slice(0, MAX_SHELTER_CANDIDATES).map(c => c.shelter);
    if (top.length === 0) return;

    const [first, ...rest] = top;
    setPendingDestination(null);
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clearPendingPin' }));
    setDestination({
      lat: first.lat, lng: first.lng, name: first.name, isShelter: true,
      _isAutoShelterSearch: true,
      _shelterCandidates: rest,
    } as any);
  };

  const handleConfirmRoute = (targetMode: Mode) => {
    if (!pendingDestination) return;
    setMode(targetMode);
    setDestination(pendingDestination);
    setPendingDestination(null);
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clearPendingPin' }));
  };

  const handleCancelPending = () => {
    setPendingDestination(null);
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clearPendingPin' }));
  };

  const handleCenterOnSelf = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'centerOnSelf' }));
  };

  // ── 経路をクリア（案内中止）──
  const handleClearRoute = () => {
    setDestination(null);
    setDistance(null);
    setIsAvoidingDisaster(false);
    setCascadeDestName(null);
    lastRouteKeyRef.current = '';
    lastRoutedTargetRef.current = '';
    lastAnnouncedRef.current = '';
    currentRoutePathRef.current = [];
    routedDestRef.current = null;
    arrivedRef.current = false;
    try { Speech.stop(); } catch {}
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clearRoute' }));
  };

  // ── #4: フォロー（追従）モードの切替 ──
  const toggleFollow = useCallback(() => {
    setFollowMode((prev) => {
      const next = !prev;
      if (next && latestUserPosRef.current) {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'panTo',
          lat: latestUserPosRef.current.lat,
          lng: latestUserPosRef.current.lng,
        }));
      }
      return next;
    });
  }, []);

  // ── #4: フォロー中は現在地が動くたびに地図を追従（ズームは維持）──
  useEffect(() => {
    if (!followMode || !webReady || !userPos) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'panTo', lat: userPos.lat, lng: userPos.lng,
    }));
  }, [followMode, webReady, userPos]);

  // ── #9: 避難所リスト（距離順・名前検索・危険圏内フラグ付き）──
  const shelterListData = React.useMemo(() => {
    const q = shelterQuery.trim();
    const dangers = disasterEvents
      .filter((e) => e.category !== 'injured')
      .map((e) => ({
        lat: e.lat, lng: e.lng,
        r: calcEnclosingRadiusM(e.packets.map((p) => ({ lat: p.lat, lng: p.lng })), e.lat, e.lng),
      }));
    return (shelterData as any[])
      .filter((s) => !q || String(s.name).includes(q))
      .map((s) => ({
        ...s,
        dist: userPos ? distanceM(userPos.lat, userPos.lng, s.lat, s.lng) : null,
        inDanger: dangers.some((d) => distanceM(s.lat, s.lng, d.lat, d.lng) <= d.r + ROUTE_AVOID_MARGIN),
      }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
      .slice(0, 80);
  }, [shelterQuery, userPos, disasterEvents]);

  // ── #9: リストから避難所を選択 → 目的地候補にしてその場所へ移動 ──
  const handleSelectShelterFromList = (s: any) => {
    setShowShelterList(false);
    setShelterQuery('');
    setPendingDestination({ lat: s.lat, lng: s.lng, name: s.name, isShelter: true });
    webViewRef.current?.postMessage(JSON.stringify({ type: 'setPendingPin', lat: s.lat, lng: s.lng }));
    webViewRef.current?.postMessage(JSON.stringify({ type: 'setMapView', lat: s.lat, lng: s.lng, zoom: 16 }));
  };

  // ── #3: 自分が危険エリア内にいるか判定 ──
  const insideDanger = React.useMemo(() => {
    if (!userPos) return null;
    for (const e of disasterEvents) {
      if (e.category === 'injured') continue;
      const r = calcEnclosingRadiusM(
        e.packets.map((p) => ({ lat: p.lat, lng: p.lng })),
        e.lat, e.lng
      );
      if (distanceM(userPos.lat, userPos.lng, e.lat, e.lng) <= r) {
        return { category: e.category, label: CATEGORY_LABEL_JP[e.category] || e.category };
      }
    }
    return null;
  }, [userPos, disasterEvents]);

  // ── #11: 危険エリアに入った瞬間に1度だけ読み上げ ──
  useEffect(() => {
    const now = !!insideDanger;
    if (now && !prevInsideDangerRef.current) {
      speak(`危険エリアに入りました。${insideDanger!.label}。直ちに避難してください`);
    }
    prevInsideDangerRef.current = now;
  }, [insideDanger, speak]);

  // ── #11: 目的地に到着したら1度だけ読み上げ（ヒステリシスで再判定）──
  useEffect(() => {
    const dest = routedDestRef.current;
    if (!dest || !userPos) { arrivedRef.current = false; return; }
    const d = distanceM(userPos.lat, userPos.lng, dest.lat, dest.lng);
    if (d <= ARRIVAL_RADIUS_M && !arrivedRef.current) {
      arrivedRef.current = true;
      speak(`${dest.name}に到着しました`);
    } else if (d > ARRIVAL_RADIUS_M * 2) {
      arrivedRef.current = false;
    }
  }, [userPos, destination, speak]);

  const dlText = dlActive && dlTotal > 0
    ? ` | オフラインDL ${Math.round((dlProgress / dlTotal) * 100)}%`
    : '';

  const headerSubText = (locLoading
    ? '現在地を取得中...'
    : locError
      ? `位置情報エラー：${locError}`
      : userPos
        ? `現在地: ${userPos.lat.toFixed(4)}, ${userPos.lng.toFixed(4)} ｜ ${mode === 'walk' ? '徒歩' : '車'}`
        : '現在地なし') + dlText;

  // フィルタボタンの定義
  const filterButtons: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'disasters', label: '災害',  icon: '🚨' },
    { key: 'shelters',  label: '避難所', icon: '🏫' },
    { key: 'injured',   label: 'けが人', icon: '🚑' },
  ];

  return (
    <MobileFrame>
      <AppBar title="マップ" subtitle={headerSubText} showBack={false} />

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          style={styles.webview}
          source={require('../../assets/web/map.html')}
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
          onLoadEnd={() => {
            setWebReady(true);
            webViewRef.current?.postMessage(
              JSON.stringify({ type: 'updateShelters', shelters: shelterData })
            );
            if (userPos) {
              webViewRef.current?.postMessage(
                JSON.stringify({ type: 'updateUsers', users: [userPos] })
              );
            }
            webViewRef.current?.postMessage(
              JSON.stringify({ type: 'getTileStats' })
            );
            // 履歴画面から遷移してきた場合は指定座標に移動
            if (paramLat && paramLng) {
              webViewRef.current?.postMessage(JSON.stringify({
                type: 'setMapView',
                lat: parseFloat(paramLat),
                lng: parseFloat(paramLng),
                zoom: paramZoom ? parseFloat(paramZoom) : 14,
              }));
            }
            // saved.tsx から pending DL があれば実行
            AsyncStorage.getItem(PENDING_DL_KEY).then((raw) => {
              if (!raw) return;
              try {
                const { maxZoom } = JSON.parse(raw);
                AsyncStorage.removeItem(PENDING_DL_KEY);
                setDlActive(true);
                setDlProgress(0);
                setDlTotal(0);
                webViewRef.current?.postMessage(
                  JSON.stringify({ type: 'downloadTiles', minZoom: 0, maxZoom })
                );
              } catch { /* ignore */ }
            });
          }}
          onMessage={onMessage}
          javaScriptEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
        />

        {isRouting && (
          <View style={styles.routingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.routingText}>経路を計算中...</Text>
          </View>
        )}

        {webReady && (
          <>
            {/* フィルタボタン（左上）*/}
            <View style={styles.filterRow}>
              {filterButtons.map((btn) => (
                <TouchableOpacity
                  key={btn.key}
                  style={[styles.filterBtn, filter[btn.key] && styles.filterBtnActive]}
                  onPress={() => handleFilter(btn.key)}
                >
                  <Text style={styles.filterBtnText}>
                    {btn.icon} {btn.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {showMapGuide && (
              <View style={[styles.guideCard, insideDanger && { top: 110 }]}>
                <Text style={styles.guideTitle}>操作ガイド</Text>
                <Text style={styles.guideText}>💾 右上ボタンでこのエリアをオフライン保存</Text>
                <Text style={styles.guideText}>🔍 左上フィルタで災害・避難所の表示を切替</Text>
                <TouchableOpacity
                  style={styles.guideClose}
                  onPress={handleDismissGuide}
                >
                  <Text style={styles.guideCloseText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* #3: 危険エリア内にいるときの警告バナー */}
            {insideDanger && (
              <View style={styles.dangerBanner}>
                <Ionicons name="warning" size={20} color="#fff" />
                <Text style={styles.dangerBannerText}>
                  危険エリア内にいます（{insideDanger.label}）— 直ちに避難してください
                </Text>
              </View>
            )}

            {/* #11: 音声案内・大文字モードの切替（右上）*/}
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={[styles.controlBtn, voiceOn && styles.controlBtnActive]}
                onPress={toggleVoice}
                accessibilityLabel={voiceOn ? '音声案内オン' : '音声案内オフ'}
              >
                <Ionicons
                  name={voiceOn ? 'volume-high' : 'volume-mute'}
                  size={20}
                  color={voiceOn ? '#2563EB' : '#64748B'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, largeText && styles.controlBtnActive]}
                onPress={toggleLargeText}
                accessibilityLabel={largeText ? '大文字モードオン' : '大文字モードオフ'}
              >
                <Text style={[styles.controlBtnLabel, largeText && { color: '#2563EB' }]}>あ</Text>
              </TouchableOpacity>
            </View>
{/*
            件数バッジ（右上）
            <View style={styles.badgeCol}>
              {disasterCount > 0 && filter.disasters && (
                <View style={[styles.badge, { borderColor: '#F59E0B' }]}>
                  <Text style={[styles.badgeText, { color: '#92400E' }]}>
                    🚨 {disasterCount} 件
                  </Text>
                </View>
              )}
              {injuredCount > 0 && filter.injured && (
                <View style={[styles.badge, { borderColor: '#F97316' }]}>
                  <Text style={[styles.badgeText, { color: '#9A3412' }]}>
                    🚑 {injuredCount} 件
                  </Text>
                </View>
              )}
            </View>
*/}
            {/* #9: 避難所リストを開く */}
            <TouchableOpacity
              style={styles.shelterListButton}
              onPress={() => setShowShelterList(true)}
            >
              <Ionicons name="list" size={22} color="#007AFF" />
            </TouchableOpacity>

            {/* 保存履歴ボタン（常時表示）*/}
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push('/map/saved' as any)}
            >
              <Ionicons name="time-outline" size={22} color="#007AFF" />
            </TouchableOpacity>

            {/* #4: フォロー（追従）モード切替 */}
            <TouchableOpacity
              style={[styles.followButton, followMode && styles.followButtonActive, (!userPos || locLoading) && { opacity: 0.5 }]}
              onPress={toggleFollow}
              disabled={!userPos || locLoading}
            >
              <Ionicons name="navigate" size={22} color={followMode ? '#fff' : '#007AFF'} />
            </TouchableOpacity>

            {/* 現在地に戻る */}
            <TouchableOpacity
              style={[styles.locateButton, (!userPos || locLoading) && { opacity: 0.5 }]}
              onPress={handleCenterOnSelf}
              disabled={!userPos || locLoading}
            >
              <Ionicons name="locate" size={26} color="#007AFF" />
            </TouchableOpacity>

            {/* 下部カード */}
            <SafeAreaView style={styles.infoCard}>
              {pendingDestination ? (
                <>
                  <View style={styles.infoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.destLabel}>目的地（未確定）</Text>
                      <Text style={styles.destName} numberOfLines={1}>
                        {pendingDestination.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.shelterBtn, { flex: 1 }]} onPress={() => handleConfirmRoute('walk')}>
                      <Ionicons name="walk" size={20} color="white" />
                      <Text style={styles.btnText}>徒歩</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.shelterBtn, { flex: 1 }]} onPress={() => handleConfirmRoute('car')}>
                      <Ionicons name="car" size={20} color="white" />
                      <Text style={styles.btnText}>車</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modeBtn, { flex: 1 }]} onPress={handleCancelPending}>
                      <Ionicons name="close" size={22} color="#333" />
                      <Text style={[styles.btnText, styles.modeBtnText]}>取消</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.destLabel}>目的地</Text>
                      <Text style={[styles.destName, largeText && styles.destNameLg]} numberOfLines={1}>
                        {cascadeDestName
                          ? `${cascadeDestName}（経路変更）`
                          : destination ? destination.name : '地図をタップして選択'}
                      </Text>
                    </View>
                    {destination && distance !== null && !isRouting && (
                      <View style={styles.distanceRow}>
                        {isAvoidingDisaster && (
                          <View style={styles.avoidanceBadge}>
                            <Text style={styles.avoidanceText}>⚠ 迂回中</Text>
                          </View>
                        )}
                        <View style={styles.distanceBadge}>
                          <Text style={[styles.distanceText, largeText && styles.distanceTextLg]}>
                            {distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`}
                          </Text>
                        </View>
                        <View style={styles.etaBadge}>
                          <Ionicons
                            name={mode === 'walk' ? 'walk' : 'car'}
                            size={largeText ? 16 : 13}
                            color={Design.colors.textMuted}
                          />
                          <Text style={[styles.etaText, largeText && styles.etaTextLg]}>{formatEta(distance, mode)}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.shelterBtn, isRouting && { opacity: 0.6 }]}
                      onPress={() => handleNearestShelter('walk')}
                      disabled={isRouting || !userPos}
                    >
                      <Ionicons name="walk" size={20} color="white" />
                      <Text style={styles.btnText}>徒歩で避難</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shelterBtn, isRouting && { opacity: 0.6 }]}
                      onPress={() => handleNearestShelter('car')}
                      disabled={isRouting || !userPos}
                    >
                      <Ionicons name="car" size={20} color="white" />
                      <Text style={styles.btnText}>車で避難</Text>
                    </TouchableOpacity>
                    {destination && (
                      <TouchableOpacity
                        style={[styles.modeBtn, { flex: 1 }]}
                        onPress={handleClearRoute}
                      >
                        <Ionicons name="close" size={22} color="#333" />
                        <Text style={[styles.btnText, styles.modeBtnText]}>中止</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </SafeAreaView>
          </>
        )}

        {/* #9: 避難所リスト（検索つき・距離順）*/}
        <Modal
          visible={showShelterList}
          animationType="slide"
          transparent
          onRequestClose={() => setShowShelterList(false)}
        >
          <View style={styles.sheetBackdrop}>
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, largeText && { fontSize: 20 }]}>避難所一覧</Text>
                <TouchableOpacity onPress={() => { setShowShelterList(false); setShelterQuery(''); }}>
                  <Ionicons name="close" size={26} color="#334155" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="避難所名で検索"
                  placeholderTextColor="#94A3B8"
                  value={shelterQuery}
                  onChangeText={setShelterQuery}
                  autoCorrect={false}
                />
                {shelterQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setShelterQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={shelterListData}
                keyExtractor={(item) => String(item.id ?? `${item.name}|${item.lat}|${item.lng}`)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.sheetEmpty}>該当する避難所がありません</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.shelterRow} onPress={() => handleSelectShelterFromList(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.shelterRowName, largeText && { fontSize: 18 }]} numberOfLines={1}>
                        🏫 {item.name}
                      </Text>
                      {item.inDanger && (
                        <Text style={styles.shelterRowDanger}>⚠ 危険エリア付近</Text>
                      )}
                    </View>
                    {item.dist != null && (
                      <Text style={styles.shelterRowDist}>
                        {item.dist >= 1000 ? `${(item.dist / 1000).toFixed(1)}km` : `${Math.round(item.dist)}m`}
                      </Text>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </View>
        </Modal>
      </View>
      <BottomTab />
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  mapContainer: { flex: 1, backgroundColor: Design.colors.background },
  webview:      { flex: 1 },

  routingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  routingText: {
    color: Design.colors.white,
    marginTop: Design.spacing.md,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },

  // フィルタボタン行（左上）
  filterRow: {
    position: 'absolute',
    top: 12,
    left: Design.spacing.lg,
    flexDirection: 'row',
    gap: 8,
    zIndex: 15,
  },
  filterBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  guideCard: {
    position: 'absolute',
    top: 52,
    left: Design.spacing.lg,
    right: Design.spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 15,
  },
  guideTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3,
  },
  guideText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#334155',
  },
  guideClose: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  guideCloseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // 件数バッジ（右上）
  badgeCol: {
    position: 'absolute',
    top: 12,
    right: Design.spacing.lg,
    gap: 6,
    zIndex: 15,
  },
  badge: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  historyButton: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 194,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 46,
    height: 46,
    borderRadius: Design.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  locateButton: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 130,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 52,
    height: 52,
    borderRadius: Design.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  // #4: フォローボタン
  followButton: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 258,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 46,
    height: 46,
    borderRadius: Design.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  followButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  // #9: 避難所リストボタン
  shelterListButton: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 322,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 46,
    height: 46,
    borderRadius: Design.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  // #11: 右上の音声・大文字トグル
  controlRow: {
    position: 'absolute',
    top: 12,
    right: Design.spacing.lg,
    flexDirection: 'row',
    gap: 8,
    zIndex: 15,
  },
  controlBtn: {
    backgroundColor: '#FFFFFF',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  controlBtnLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  // #9: 避難所リストのボトムシート
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  sheetEmpty: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingVertical: 24,
    fontSize: 14,
  },
  shelterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shelterRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  shelterRowDanger: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 2,
  },
  shelterRowDist: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  infoCard: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 20,
    left: 20,
    right: 20,
    backgroundColor: Design.colors.background,
    borderRadius: 16,
    padding: 8,
    zIndex: 10,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  destLabel: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.bold,
  },
  destName: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avoidanceBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  avoidanceText: {
    color: '#92400E',
    fontWeight: Design.fontWeight.bold,
    fontSize: 11,
  },
  surroundedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Design.radius.md,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  surroundedText: {
    color: '#92400E',
    fontWeight: Design.fontWeight.bold,
    fontSize: 11,
  },
  // ── A-1: 危険エリア通過警告バッジ（フォールバック検出時に表示）──
  penetrationBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Design.radius.md,
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  penetrationText: {
    color: '#991B1B',
    fontWeight: Design.fontWeight.bold,
    fontSize: 11,
  },
  distanceBadge: {
    backgroundColor: Design.colors.primaryMuted,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 3,
    borderRadius: Design.radius.md,
  },
  distanceText: {
    color: Design.colors.primary,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  // #6: 所要時間バッジ
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Design.colors.surface,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 3,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  etaText: {
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.bold,
    fontSize: 12,
  },
  // #11: 大文字モードの拡大スタイル
  destNameLg:     { fontSize: 22 },
  distanceTextLg: { fontSize: 20 },
  etaTextLg:      { fontSize: 16 },
  // #3: 危険エリア内警告バナー
  dangerBanner: {
    position: 'absolute',
    top: 52,
    left: Design.spacing.lg,
    right: Design.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  dangerBannerText: {
    flex: 1,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  shelterBtn: {
    flex: 2,
    backgroundColor: Design.colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: Design.radius.md,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: Design.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  btnText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    marginLeft: Design.spacing.sm,
    fontSize: Design.fontSize.body,
  },
  modeBtnText: { color: Design.colors.text },
});
