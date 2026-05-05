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
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as turf from '@turf/helpers';
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
// 現在地: 渋谷ヒカリエ (35.6591, 139.7038)
// 全イベントをヒカリエ北西 200〜400m 圏内（神南小学校・大和田への経路上）に集中配置
const NOW = Date.now() / 1000;
const DUMMY_PACKETS: RawPacket[] = [
  // 浸水クラスター（公園通り〜センター街付近）
  // 3枚公式 → score≈15 → ★★ → 回避半径200m
  {
    id: 'a1', category: 'flood', severity: 4,
    lat: 35.6614, lng: 139.7002,
    timestamp: NOW - 60, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '公園通りが膝上まで浸水',
  },
  {
    id: 'a2', category: 'flood', severity: 4,
    lat: 35.6618, lng: 139.6998,
    timestamp: NOW - 90, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '消防署確認済み 車両通行不可',
  },
  {
    id: 'a3', category: 'flood', severity: 5,
    lat: 35.6610, lng: 139.7006,
    timestamp: NOW - 120, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '排水溝が逆流 急速に水位上昇中',
  },
  {
    id: 'a4', category: 'flood', severity: 3,
    lat: 35.6616, lng: 139.7004,
    timestamp: NOW - 200, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '地下への浸水も確認',
  },
  {
    id: 'a5', category: 'flood', severity: 3,
    lat: 35.6612, lng: 139.7000,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },
  // 火災クラスター（宇田川町付近）
  // 2枚公式 → score≈10 → ★★ → 回避半径200m
  {
    id: 'b1', category: 'fire', severity: 5,
    lat: 35.6628, lng: 139.6986,
    timestamp: NOW - 80, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '宇田川町で建物火災 消防車8台出動',
  },
  {
    id: 'b2', category: 'fire', severity: 4,
    lat: 35.6625, lng: 139.6990,
    timestamp: NOW - 150, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '延焼中 周辺に近づかないこと',
  },
  // 建物倒壊（道玄坂上付近）
  {
    id: 'e1', category: 'building_collapse', severity: 5,
    lat: 35.6583, lng: 139.6995,
    timestamp: NOW - 180, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '道玄坂上 古いビルが倒壊 要救助者あり',
  },
  {
    id: 'e2', category: 'building_collapse', severity: 4,
    lat: 35.6580, lng: 139.6998,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '瓦礫が道路に散乱',
  },
  // ガス漏れ（渋谷3丁目付近）
  /*
  {
    id: 'f1', category: 'gas_leak', severity: 3,
    lat: 35.6599, lng: 139.7048,
    timestamp: NOW - 350, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: 'ガス臭が強い',
  },
  // 道路閉塞（宮益坂）
  */
  {
    id: 'c1', category: 'road_block', severity: 3,
    lat: 35.6601, lng: 139.7030,
    timestamp: NOW - 400, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '宮益坂 落下物で通行止め',
  },
  {
    id: 'c2', category: 'road_block', severity: 2,
    lat: 35.6604, lng: 139.7026,
    timestamp: NOW - 500, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '信号機が倒れ道路をふさいでいる',
  },
  {
    id: 'c3', category: 'road_block', severity: 2,
    lat: 35.6596, lng: 139.7022,
    timestamp: NOW - 700, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '通行止め',
  },
  
  // けが人（クラスター内）
  {
    id: 'd1', category: 'injured', severity: 4,
    lat: 36.6600, lng: 139.7348,
    timestamp: NOW - 140, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '倒壊建物の下敷き 119通報済み',
  },
  // 火災延焼（宇田川クラスター北側に隣接・約96m → 同クラスターに合流）
  {
    id: 'g1', category: 'fire', severity: 4,
    lat: 35.6636, lng: 139.6982,
    timestamp: NOW - 320, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '神南方向に延焼 煙が視認できる',
  },
  // 建物倒壊拡大（道玄坂クラスターに隣接・約82m → 同クラスターに合流）
  {
    id: 'h1', category: 'building_collapse', severity: 4,
    lat: 35.6576, lng: 139.6992,
    timestamp: NOW - 450, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '道玄坂下 隣接ビルにも倒壊被害',
  },
  // 土砂崩れ（神泉・松濤の斜面 — 単独）
  {
    id: 'i1', category: 'landslide', severity: 3,
    lat: 35.6545, lng: 139.6927,
    timestamp: NOW - 600, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '神泉駅付近 松濤の急斜面が崩落',
  },
  // 恵比寿で別火災（南東エリア — 単独）
  {
    id: 'j1', category: 'fire', severity: 3,
    lat: 35.6463, lng: 139.7102,
    timestamp: NOW - 480, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '恵比寿1丁目 飲食店から出火',
  },
  // 千駄ヶ谷浸水（北東エリア — 単独）
  {
    id: 'k1', category: 'flood', severity: 3,
    lat: 35.6759, lng: 139.7106,
    timestamp: NOW - 700, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '千駄ヶ谷駅周辺 地下道に浸水',
  },
  // 神泉駅前 道路閉塞（西エリア — 単独）
  {
    id: 'l1', category: 'road_block', severity: 3,
    lat: 35.6601, lng: 139.6920,
    timestamp: NOW - 560, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '神泉駅前 崩落した壁が道路をふさぐ',
  },

];

const SELF_ID = 'userA';
type Mode = 'walk' | 'car';

type UserPos     = { id: string; lat: number; lng: number };
type Destination = { lat: number; lng: number; name: string; isShelter: boolean };

// ── フィルタの型 ──────────────────────────────────
type FilterKey = 'disasters' | 'shelters' | 'injured';
type FilterState = Record<FilterKey, boolean>;

type DangerEvent = ScoredEvent & { enclosingRadiusM: number };

const ROUTE_AVOID_MARGIN = 30;
const SAFE_CLIP_PAD      = 0.10; // ~11km: 安全迂回用の広域bbox
const NORMAL_CLIP_PAD    = 0.06; // ~6.7km: 通常ルート・ペナルティ用
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
  const routingInitPromiseRef = useRef<Promise<boolean> | null>(null);
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
  const [showMapGuide, setShowMapGuide] = useState(true);
  const [cascadeDestName, setCascadeDestName] = useState<string | null>(null);

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

  // ── 現在地: 渋谷ヒカリエホール（固定）──
  useEffect(() => {
    setUserPos({ id: SELF_ID, lat: 35.6591, lng: 139.7038 });
    setLocLoading(false);
  }, []);

  const ensureRoutingReady = useCallback(async (targetMode: Mode): Promise<boolean> => {
    const readyForMode = targetMode === 'walk' ? walkLoadedRef.current : carLoadedRef.current;
    if (readyForMode) return true;
    if (routingInitPromiseRef.current) return routingInitPromiseRef.current;
    routingInitPromiseRef.current = (async () => {
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
        setTimeout(() => {
          if (targetMode === 'walk' && !carLoadedRef.current) ensureRoutingReady('car');
          if (targetMode === 'car' && !walkLoadedRef.current) ensureRoutingReady('walk');
        }, 100);
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
        routingInitPromiseRef.current = null;
      }
    })();
    return routingInitPromiseRef.current;
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
          const carClipped   = clipToBbox(carExplodedRef.current, start.lat, start.lng, finalDest.lat, finalDest.lng, NORMAL_CLIP_PAD);
          const carFeatures  = carClipped.length > 50 ? carClipped : carExplodedRef.current;
          const carNodes     = extractNodes(carFeatures);
          const carSnapStart = nearestPointOnRoads(turf.point([start.lng, start.lat]), carFeatures);
          const carStart     = snapToNearestNode(carSnapStart, carNodes.length > 10 ? carNodes : carNodesRef.current);
          const carSnapEnd   = nearestPointOnRoads(turf.point([finalDest.lng, finalDest.lat]), carFeatures);
          const carEnd       = snapToNearestNode(carSnapEnd, carNodes.length > 10 ? carNodes : carNodesRef.current);
          const [csl, csa]   = carStart.geometry.coordinates as [number, number];
          const [cel, cea]   = carEnd.geometry.coordinates   as [number, number];

          if (nearbyDangers.length > 0) {
            const { graph: safeCarGraph, removedAny } = buildGraph(carFeatures, nearbyDangers, ROUTE_AVOID_MARGIN);
            path = runAStar(safeCarGraph, csl, csa, cel, cea);
            if (removedAny && path) isAvoidance = true;
          } else {
            const { graph: carGraph } = buildGraph(carFeatures);
            path = runAStar(carGraph, csl, csa, cel, cea);
          }
          if (path) console.log('[A*] Walk disconnected, used car network');
        }

        const elapsed = Date.now() - t0;
        if (path) {
          let trueDist = 0;
          for (let i = 0; i < path.length - 1; i++) {
            trueDist += distanceM(path[i][1], path[i][0], path[i + 1][1], path[i + 1][0]);
          }
          setDistance(Math.round(trueDist));
          setIsAvoidingDisaster(isAvoidance);
          setCascadeDestName(cascadeToName);

          // デバッグ用アサーション（安全グラフのみ使用しているため通常は発生しない）
          if (__DEV__ && nearbyDangers.length > 0) {
            const verify = pathPenetratesDanger(path, nearbyDangers, ROUTE_AVOID_MARGIN);
            if (verify.penetrated) console.error('[A*] BUG: path still penetrates danger zone');
          }

          const coords = path.map(([lng, lat]) => [lat, lng]);
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
  }, [mode]); // disasterEventsを依存から外す: refで読むため再生成不要

  // 目的地・モード・現在地・WebView準備が変わったとき: キーをリセットして再探索
  useEffect(() => {
    if (!webReady || !destination || !userPos) return;
    lastRouteKeyRef.current = '';
    setCascadeDestName(null);
    const t0 = Date.now();
    (async () => {
      const ok = await ensureRoutingReady(mode);
      if (!ok) return;
      const initElapsed = Date.now() - t0;
      if (initElapsed > 5000) console.warn(`[Route] Init took ${initElapsed}ms (>5s target)`);
      findRoute(userPos, destination);
    })();
  }, [webReady, mode, destination, userPos, findRoute, ensureRoutingReady]);

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
              <View style={styles.guideCard}>
                <Text style={styles.guideTitle}>操作ガイド</Text>
                <Text style={styles.guideText}>💾 右上ボタンでこのエリアをオフライン保存</Text>
                <Text style={styles.guideText}>🔍 左上フィルタで災害・避難所の表示を切替</Text>
                <TouchableOpacity
                  style={styles.guideClose}
                  onPress={() => setShowMapGuide(false)}
                >
                  <Text style={styles.guideCloseText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            )}
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
            {/* 保存履歴ボタン（常時表示）*/}
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push('/map/saved' as any)}
            >
              <Ionicons name="time-outline" size={22} color="#007AFF" />
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
                      <Text style={styles.destName} numberOfLines={1}>
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
                          <Text style={styles.distanceText}>
                            {distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`}
                          </Text>
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
                      <Text style={styles.btnText}>最寄り避難所</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shelterBtn, isRouting && { opacity: 0.6 }]}
                      onPress={() => handleNearestShelter('car')}
                      disabled={isRouting || !userPos}
                    >
                      <Ionicons name="car" size={20} color="white" />
                      <Text style={styles.btnText}>最寄り避難所</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </SafeAreaView>
          </>
        )}
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
