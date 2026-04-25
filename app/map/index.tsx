import { AppBar } from '@/components/AppBar';
import { BottomTab, BOTTOM_TAB_HEIGHT } from '@/components/BottomTab';
import { MobileFrame } from '@/components/MobileFrame';
import { Design } from '@/constants/Design';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as turf from '@turf/helpers';
import nearestPointOnLineFn from '@turf/nearest-point-on-line';
import PathFinder from 'geojson-path-finder';
import { WebView } from 'react-native-webview';

import * as Location from 'expo-location';

import { useOnline } from '@/hooks/useOnline';
import shelterData from '../../assets/shelters.json';
import { appendMapSaveHistory, type MapSaveHistoryItem } from '../../lib/mapSaveHistory';

// ── TrustMap（アプリ全体シングルトン）──────────────
import type { RawPacket, ScoredEvent } from '../../trustmap-scoring/src/index';
import { trustMapEngine } from '../../lib/trustmap';
import { useDisasterReport } from '../../contexts/DisasterReportContext';

// ── ダミーパケット（動作確認用・本番では削除）────
const NOW = Date.now() / 1000;
const DUMMY_PACKETS: RawPacket[] = [
  {
    id: 'a1', category: 'flood', severity: 4,
    lat: 35.6580, lng: 139.7000,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '道路が浸水',
  },
  {
    id: 'a2', category: 'flood', severity: 3,
    lat: 35.6583, lng: 139.7005,
    timestamp: NOW - 600, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },
  {
    id: 'a3', category: 'flood', severity: 4,
    lat: 35.6577, lng: 139.6995,
    timestamp: NOW - 120, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '消防署確認済み',
  },
  {
    id: 'b1', category: 'fire', severity: 4,
    lat: 35.6620, lng: 139.7050,
    timestamp: NOW - 90, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '住宅街で火災発生',
  },
  {
    id: 'c1', category: 'road_block', severity: 2,
    lat: 35.6540, lng: 139.6980,
    timestamp: NOW - 1200, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '土砂で通行止め',
  },
  {
    id: 'd1', category: 'injured', severity: 3,
    lat: 35.6600, lng: 139.7020,
    timestamp: NOW - 200, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '足をけがした人がいる',
  },
  {
    id: 'd2', category: 'injured', severity: 4,
    lat: 35.6602, lng: 139.7022,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '動けない状態',
  },
];

const SELF_ID = 'userA';
type Mode = 'walk' | 'car';

type UserPos     = { id: string; lat: number; lng: number };
type Destination = { lat: number; lng: number; name: string; isShelter: boolean };

// ── フィルタの型 ──────────────────────────────────
type FilterKey = 'disasters' | 'shelters' | 'injured';
type FilterState = Record<FilterKey, boolean>;

// ── 災害回避の半径（★ごと）──────────────────────
const DISASTER_RADIUS_M: Record<1 | 2 | 3, number> = {
  3: 100, 2: 60, 1: 30,
}

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

function filterSafeNodes(nodes: number[][], events: ScoredEvent[]): number[][] {
  const dangerEvents = events.filter(e => e.category !== 'injured')
  if (dangerEvents.length === 0) return nodes
  return nodes.filter(([lng, lat]) =>
    dangerEvents.every((e) => distanceM(lat, lng, e.lat, e.lng) > DISASTER_RADIUS_M[e.stars])
  )
}

function filterSafeRoads(features: any[], events: ScoredEvent[]): any[] {
  const dangerEvents = events.filter(e => e.category !== 'injured')
  if (dangerEvents.length === 0) return features
  return features.filter((f: any) => {
    const coords = f.geometry.coordinates as number[][]
    return coords.every(([lng, lat]) =>
      dangerEvents.every((e) => distanceM(lat, lng, e.lat, e.lng) > DISASTER_RADIUS_M[e.stars])
    )
  })
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
  const MAX_RADIUS = 500;
  if (!witnessCoords || witnessCoords.length <= 1) return MIN_RADIUS;
  let maxDist = 0;
  for (const w of witnessCoords) {
    const d = distanceM(centerLat, centerLng, w.lat, w.lng);
    if (d > maxDist) maxDist = d;
  }
  return Math.max(MIN_RADIUS, Math.min(maxDist, MAX_RADIUS));
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

  const walkFinderRef = useRef<any>(null);
  const carFinderRef  = useRef<any>(null);
  const walkNodesRef  = useRef<number[][]>([]);
  const carNodesRef   = useRef<number[][]>([]);
  const walkExplodedRef = useRef<any[]>([]);
  const carExplodedRef  = useRef<any[]>([]);
  const safeFinderRef = useRef<any>(null);
  const safeFinderKeyRef = useRef<string>('');
  const initialCenteredRef = useRef(false);
  const routingInitPromiseRef = useRef<Promise<boolean> | null>(null);
  const roadFeaturesRef = useRef<any[]>([]);
  const sentDisasterHashesRef = useRef<Record<string, string>>({});
  const latestUserPosRef = useRef<UserPos | null>(null);
  const disasterEventsRef = useRef<ScoredEvent[]>([]);
  const isRoutingRef = useRef(false);
  const lastRouteKeyRef = useRef<string>('');
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

  // ── GPS: 初回は即時取得、その後は移動に追従（タイル自動取得・経路と整合）──
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        setLocLoading(true);
        setLocError(null);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocError('位置情報の権限がありません（設定から許可してください）');
          setLocLoading(false);
          return;
        }
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserPos({
          id: SELF_ID,
          lat: first.coords.latitude,
          lng: first.coords.longitude,
        });
        setLocLoading(false);

        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          (loc) => {
            setUserPos({
              id: SELF_ID,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            });
          }
        );
      } catch (e: any) {
        setLocError(String(e?.message ?? e));
        setLocLoading(false);
      }
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  const ensureRoutingReady = useCallback(async (targetMode: Mode): Promise<boolean> => {
    const readyForMode = targetMode === 'walk'
      ? !!walkFinderRef.current
      : !!carFinderRef.current;
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
        if (targetMode === 'walk' && !walkFinderRef.current) {
          const WALK_EXCLUDE = new Set([
            'motorway', 'motorway_link', 'service', 'track',
            'cycleway', 'bridleway', 'raceway', 'bus_guideway',
            'construction', 'proposed',
          ]);
          const walkRaw = allFeatures.filter(
            (f: any) => f.properties?.highway && !WALK_EXCLUDE.has(f.properties.highway)
          );
          const walkExp = explodeMultiLineStrings(walkRaw);
          walkExplodedRef.current = walkExp;
          walkFinderRef.current = new PathFinder(turf.featureCollection(walkExp));
          walkNodesRef.current = extractNodes(walkExp);
        }
        if (targetMode === 'car' && !carFinderRef.current) {
          const carRaw = allFeatures.filter(
            (f: any) => f.properties?.highway &&
              !['footway', 'steps', 'pedestrian'].includes(f.properties.highway)
          );
          const carExp  = explodeMultiLineStrings(carRaw);
          carExplodedRef.current = carExp;
          carFinderRef.current = new PathFinder(turf.featureCollection(carExp));
          carNodesRef.current = extractNodes(carExp);
        }
        setTimeout(() => {
          if (targetMode === 'walk' && !carFinderRef.current) ensureRoutingReady('car');
          if (targetMode === 'car' && !walkFinderRef.current) ensureRoutingReady('walk');
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

  // ── 経路探索（災害エリア回避付き）────────────────
  const findRoute = useCallback((start: UserPos, end: Destination) => {
    const isWalk = mode === 'walk';
    const finder = isWalk ? walkFinderRef.current : carFinderRef.current;
    const nodes  = isWalk ? walkNodesRef.current  : carNodesRef.current;
    if (!finder || nodes.length === 0) {
      console.warn(`[Route] Skipped: finder=${!!finder}, nodes=${nodes?.length ?? 0}, mode=${mode}`);
      return;
    }

    const routeKey = [
      start.lat.toFixed(5), start.lng.toFixed(5),
      end.lat.toFixed(5), end.lng.toFixed(5),
      mode,
    ].join('|');
    if (routeKey === lastRouteKeyRef.current) {
      console.log('[Route] Skipped: same routeKey');
      return;
    }
    if (isRoutingRef.current) {
      console.log('[Route] Skipped: already routing');
      return;
    }

    lastRouteKeyRef.current = routeKey;
    isRoutingRef.current = true;
    setIsRouting(true);
    const t0 = Date.now();
    setTimeout(() => {
      try {
        const currentEvents = disasterEventsRef.current;
        const exploded = isWalk ? walkExplodedRef.current : carExplodedRef.current;
        const clipped = clipToBbox(exploded, start.lat, start.lng, end.lat, end.lng);
        const roadsForSnap = clipped.length > 10 ? clipped : exploded;
        const startPoint = turf.point([start.lng, start.lat]);
        const endPoint   = turf.point([end.lng, end.lat]);
        const snapStart  = nearestPointOnRoads(startPoint, roadsForSnap);
        const snapEnd    = nearestPointOnRoads(endPoint, roadsForSnap);

        const routePad = 0.02;
        const bboxMinLat = Math.min(start.lat, end.lat) - routePad;
        const bboxMaxLat = Math.max(start.lat, end.lat) + routePad;
        const bboxMinLng = Math.min(start.lng, end.lng) - routePad;
        const bboxMaxLng = Math.max(start.lng, end.lng) + routePad;
        const nearbyDangers = currentEvents.filter(e =>
          e.category !== 'injured' &&
          e.lat >= bboxMinLat && e.lat <= bboxMaxLat &&
          e.lng >= bboxMinLng && e.lng <= bboxMaxLng
        );

        const startNode = snapToNearestNode(snapStart, nodes);
        const endNode   = snapToNearestNode(snapEnd,   nodes);

        let result: any = null;
        let usedSafeFinder = false;

        if (nearbyDangers.length > 0) {
          try {
            const widerClip = clipToBbox(exploded, start.lat, start.lng, end.lat, end.lng, 0.15);
            const safeSource = widerClip.length > 50 ? widerClip : exploded;
            const safeNodes = filterSafeNodes(nodes, nearbyDangers);
            const bboxKey = [bboxMinLat.toFixed(3), bboxMaxLat.toFixed(3), bboxMinLng.toFixed(3), bboxMaxLng.toFixed(3)].join(',');
            const safeKey = mode + '|' + bboxKey + '|' + nearbyDangers.map(e => `${e.lat},${e.lng},${e.stars}`).join('|');
            if (!safeFinderRef.current || safeFinderKeyRef.current !== safeKey) {
              const safeRoads = filterSafeRoads(safeSource, nearbyDangers);
              safeFinderRef.current = safeRoads.length > 10
                ? new PathFinder(turf.featureCollection(safeRoads))
                : finder;
              safeFinderKeyRef.current = safeKey;
            }
            const safeRoutingNodes = safeNodes.length > 10 ? safeNodes : nodes;
            const safeStart = snapToNearestNode(snapStart, safeRoutingNodes);
            const safeEnd   = snapToNearestNode(snapEnd,   safeRoutingNodes);
            result = safeFinderRef.current.findPath(safeStart, safeEnd);
            usedSafeFinder = true;
          } catch (safeErr) {
            console.warn('[Route] Safe finder construction/search failed, falling back', safeErr);
          }
        }

        if (!result?.path) {
          result = finder.findPath(startNode, endNode);
          if (result?.path && usedSafeFinder) {
            console.log('[Route] Safe finder failed, fell back to full graph (may pass through disaster)');
          }
        }

        if (!result?.path && isWalk && carFinderRef.current && carNodesRef.current.length > 0) {
          const carStart = snapToNearestNode(snapStart, carNodesRef.current);
          const carEnd   = snapToNearestNode(snapEnd,   carNodesRef.current);
          result = carFinderRef.current.findPath(carStart, carEnd);
          if (result?.path) {
            console.log('[Route] Walk graph disconnected, used car network as fallback');
          }
        }

        const elapsed = Date.now() - t0;
        if (result?.path) {
          setDistance(Math.round(result.weight * 1000));
          const coords = result.path.map((p: number[]) => [p[1], p[0]]);
          webViewRef.current?.postMessage(JSON.stringify({ type: 'drawRoute', coordinates: coords }));
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'updateDestinationPin',
            lat: end.lat, lng: end.lng,
            name: end.name, isShelter: end.isShelter
          }));
          console.log(`[Route] OK in ${elapsed}ms`);
        } else {
          setDistance(null);
          const alertKey = 'no-route';
          const now = Date.now();
          if (lastAlertKeyRef.current !== alertKey || now - lastAlertAtRef.current > 8000) {
            lastAlertKeyRef.current = alertKey;
            lastAlertAtRef.current = now;
            Alert.alert('経路が見つかりません', '付近の道路ネットワークで経路が見つかりませんでした。');
          }
          console.log(`[Route] No path found (${elapsed}ms)`);
        }
      } catch (err) {
        console.error('Routing Error:', err);
      } finally {
        isRoutingRef.current = false;
        setIsRouting(false);
      }
    }, 10);
  }, [mode]);

  useEffect(() => {
    if (!webReady || !destination || !userPos) return;
    lastRouteKeyRef.current = '';
    const t0 = Date.now();
    (async () => {
      const ok = await ensureRoutingReady(mode);
      if (!ok) return;
      const initElapsed = Date.now() - t0;
      if (initElapsed > 5000) console.warn(`[Route] Init took ${initElapsed}ms (>5s target)`);
      findRoute(userPos, destination);
    })();
  }, [webReady, mode, destination, userPos, findRoute, ensureRoutingReady]);

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

  const handleNearestShelter = () => {
    if (!userPos) return;
    let minD = Infinity;
    let closest: any = null;
    (shelterData as any[]).forEach((s) => {
      const d = Math.pow(s.lat - userPos.lat, 2) + Math.pow(s.lng - userPos.lng, 2);
      if (d < minD) { minD = d; closest = s; }
    });
    if (closest) {
      setPendingDestination(null);
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clearPendingPin' }));
      setDestination({ lat: closest.lat, lng: closest.lng, name: closest.name, isShelter: true });
    }
  };

  const handleConfirmRoute = () => {
    if (!pendingDestination) return;
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
                    <TouchableOpacity style={styles.shelterBtn} onPress={handleConfirmRoute}>
                      <Ionicons name="navigate" size={20} color="white" />
                      <Text style={styles.btnText}>経路を検索</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modeBtn} onPress={handleCancelPending}>
                      <Ionicons name="close" size={24} color="#333" />
                      <Text style={[styles.btnText, styles.modeBtnText]}>キャンセル</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.destLabel}>目的地</Text>
                      <Text style={styles.destName} numberOfLines={1}>
                        {destination ? destination.name : '地図をタップして選択'}
                      </Text>
                    </View>
                    {destination && distance !== null && !isRouting && (
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>
                          {distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.shelterBtn, isRouting && { opacity: 0.6 }]}
                      onPress={handleNearestShelter}
                      disabled={isRouting || !userPos}
                    >
                      <Ionicons name="warning" size={20} color="white" />
                      <Text style={styles.btnText}>最寄り避難所</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modeBtn, isRouting && { opacity: 0.6 }]}
                      onPress={() => setMode((m) => (m === 'walk' ? 'car' : 'walk'))}
                      disabled={isRouting}
                    >
                      <Ionicons name={mode === 'walk' ? 'walk' : 'car'} size={24} color="#333" />
                      <Text style={[styles.btnText, styles.modeBtnText]}>
                        {mode === 'walk' ? '徒歩' : '車'}
                      </Text>
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
    bottom: BOTTOM_TAB_HEIGHT + 144,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 46,
    height: 46,
    borderRadius: Design.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  locateButton: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 80,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    width: 52,
    height: 52,
    borderRadius: Design.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 15,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  infoCard: {
    position: 'absolute',
    bottom: BOTTOM_TAB_HEIGHT + 12,
    left: 20,
    right: 20,
    backgroundColor: Design.colors.background,
    borderRadius: 16,
    padding: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
