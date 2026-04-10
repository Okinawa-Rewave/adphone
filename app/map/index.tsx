import { AppHeader } from '@/components/AppHeader';
import { BrowserHeader } from '@/components/BrowserHeader';
import { MobileFrame } from '@/components/MobileFrame';
import { Design } from '@/constants/Design';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import nearestPointOnLine from '@turf/nearest-point-on-line';
import PathFinder from 'geojson-path-finder';
import { WebView } from 'react-native-webview';

import * as Location from 'expo-location';
import { useOnline } from '@/hooks/useOnline';

import integratedRoadData from '../../assets/roads_all.json';
import shelterData from '../../assets/shelters.json';

// ── TrustMap ──────────────────────────────────────
import type { RawPacket, ScoredEvent } from '../../trustmap-scoring/src/index';
import { TrustMapEngine } from '../../trustmap-scoring/src/index';

const verifyFn = async (_pubkey: string, _payload: Uint8Array, _sig: string) => true;
const trustMapEngine = new TrustMapEngine(verifyFn);

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

export default function App() {
  const webViewRef = useRef<WebView>(null);

  const [mode, setMode]         = useState<Mode>('walk');
  const [pfReady, setPfReady]   = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const [walkFinder, setWalkFinder] = useState<any>(null);
  const [carFinder,  setCarFinder]  = useState<any>(null);
  const [walkNodes,  setWalkNodes]  = useState<number[][]>([]);
  const [carNodes,   setCarNodes]   = useState<number[][]>([]);

  const [userPos,    setUserPos]    = useState<UserPos | null>(null);
  const [locError,   setLocError]   = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  const [destination,    setDestination]    = useState<Destination | null>(null);
  const [disasterEvents, setDisasterEvents] = useState<ScoredEvent[]>([]);

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

  // ── GPS取得 ──────────────────────────────────────
  useEffect(() => {
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
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserPos({ id: SELF_ID, lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e: any) {
        setLocError(String(e?.message ?? e));
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  // ── 道路ネットワーク初期化 ──────────────────────
  useEffect(() => {
    try {
      const allFeatures = (integratedRoadData as any).features ?? [];
      const walkRaw = allFeatures.filter(
        (f: any) => f.properties?.highway && f.properties.highway !== 'motorway'
      );
      const carRaw = allFeatures.filter(
        (f: any) => f.properties?.highway &&
          !['footway', 'steps', 'pedestrian'].includes(f.properties.highway)
      );
      const walkExp = explodeMultiLineStrings(walkRaw);
      const carExp  = explodeMultiLineStrings(carRaw);
      setWalkFinder(new PathFinder(turf.featureCollection(walkExp), { precision: 1e-5 }));
      setWalkNodes(extractNodes(walkExp));
      setCarFinder(new PathFinder(turf.featureCollection(carExp), { precision: 1e-5 }));
      setCarNodes(extractNodes(carExp));
      setPfReady(true);
    } catch (e) {
      Alert.alert('エラー', 'データの初期化に失敗しました');
    }
  }, []);

  // ── TrustMap: ダミーパケット投入 & 5秒ごとに更新 ──
  useEffect(() => {
    const init = async () => {
      for (const p of DUMMY_PACKETS) {
        await trustMapEngine.onReceive(p);
      }
    };
    init();
    const id = setInterval(() => {
      if (!userPos) return;
      const events = trustMapEngine.computeScores(userPos.lat, userPos.lng);
      setDisasterEvents(events);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userPos) return;
    const events = trustMapEngine.computeScores(userPos.lat, userPos.lng);
    setDisasterEvents(events);
  }, [userPos]);

  // ── オンライン状態をWebViewに通知 ────────────────
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
  }, [webReady, userPos]);

  // ── WebViewに災害マーカーを送信 ──────────────────
  useEffect(() => {
    if (!webReady) return;
    const payload = disasterEvents.map((e) => ({
      category:      e.category,
      lat:           e.lat,
      lng:           e.lng,
      severity:      e.severity,
      score:         e.score,
      stars:         e.stars,
      witnessCount:  e.witnessCount,
      hasOfficial:   e.hasOfficial,
      note:          e.packets[0]?.note ?? '',
      witnessCoords: e.packets.map((p) => ({ lat: p.lat, lng: p.lng })),
    }));
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'updateDisasters', events: payload })
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
    const finder = isWalk ? walkFinder : carFinder;
    const nodes  = isWalk ? walkNodes  : carNodes;
    if (!finder || nodes.length === 0) return;

    setIsRouting(true);
    setTimeout(() => {
      try {
        const currentRaw = ((integratedRoadData as any).features ?? []).filter((f: any) => {
          const h = f.properties?.highway;
          return isWalk
            ? (h && h !== 'motorway')
            : (h && !['footway', 'steps', 'pedestrian'].includes(h));
        });
        const exploded = explodeMultiLineStrings(currentRaw);
        const roads    = turf.featureCollection(exploded);
        const snapStart = nearestPointOnLine(roads, turf.point([start.lng, start.lat]));
        const snapEnd   = nearestPointOnLine(roads, turf.point([end.lng, end.lat]));
        const safeNodes = filterSafeNodes(nodes, disasterEvents);
        const safeRoads = filterSafeRoads(exploded, disasterEvents);
        const routingNodes  = safeNodes.length > 10 ? safeNodes : nodes;
        const startNode     = snapToNearestNode(snapStart, routingNodes);
        const endNode       = snapToNearestNode(snapEnd,   routingNodes);
        const routingFinder = safeRoads.length > 10
          ? new PathFinder(turf.featureCollection(safeRoads), { precision: 1e-5 })
          : finder;
        const result = routingFinder.findPath(startNode, endNode);
        if (result?.path) {
          setDistance(Math.round(result.weight * 1000));
          const coords = result.path.map((p: number[]) => [p[1], p[0]]);
          webViewRef.current?.postMessage(JSON.stringify({ type: 'drawRoute', coordinates: coords }));
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'updateDestinationPin',
            lat: end.lat, lng: end.lng,
            name: end.name, isShelter: end.isShelter
          }));
        } else {
          setDistance(null);
          Alert.alert('経路が見つかりません', '災害エリアを避けると経路が見つかりませんでした。');
        }
      } catch (err) {
        console.error('Routing Error:', err);
      } finally {
        setIsRouting(false);
      }
    }, 10);
  }, [mode, walkFinder, carFinder, walkNodes, carNodes, disasterEvents]);

  useEffect(() => {
    if (!pfReady || !webReady || !destination || !userPos) return;
    findRoute(userPos, destination);
  }, [pfReady, webReady, mode, destination, userPos, findRoute]);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapTap') {
        setDestination({ lat: data.lat, lng: data.lng, name: '選択した地点', isShelter: false });
      }
      if (data.type === 'shelterTap') {
        setDestination({ lat: data.lat, lng: data.lng, name: data.name, isShelter: true });
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
      setDestination({ lat: closest.lat, lng: closest.lng, name: closest.name, isShelter: true });
    }
  };

  const handleCenterOnSelf = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'centerOnSelf' }));
  };

  const headerSubText = locLoading
    ? '現在地を取得中...'
    : locError
      ? `位置情報エラー：${locError}`
      : userPos
        ? `現在地: ${userPos.lat.toFixed(4)}, ${userPos.lng.toFixed(4)} ｜ ${mode === 'walk' ? '徒歩' : '車'}`
        : '現在地なし';

  // フィルタボタンの定義
  const filterButtons: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'disasters', label: '災害',  icon: '🚨' },
    { key: 'shelters',  label: '避難所', icon: '🏫' },
    { key: 'injured',   label: 'けが人', icon: '🚑' },
  ];

  const disasterCount = disasterEvents.filter(e => e.category !== 'injured').length;
  const injuredCount  = disasterEvents.filter(e => e.category === 'injured').length;

  return (
    <MobileFrame>
      <BrowserHeader />
      <AppHeader title="マップ" subtitle={headerSubText} />

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

        {pfReady && webReady && (
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
            </SafeAreaView>
          </>
        )}
      </View>
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

  locateButton: {
    position: 'absolute',
    bottom: 160,
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
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Design.colors.background,
    borderRadius: 20,
    padding: 12,
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
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  distanceBadge: {
    backgroundColor: Design.colors.primaryMuted,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderRadius: Design.radius.md,
  },
  distanceText: {
    color: Design.colors.primary,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Design.spacing.md,
  },
  shelterBtn: {
    flex: 2,
    backgroundColor: Design.colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Design.spacing.md,
    borderRadius: Design.radius.md,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: Design.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Design.spacing.md,
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
