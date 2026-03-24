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
  // ── クラスターA: 浸水（4人・50m範囲に散らばる → 大きい円）──
  {
    id: 'a1', category: 'flood', severity: 4,
    lat: 26.5920, lng: 127.9780,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '道路が浸水',
  },
  {
    id: 'a2', category: 'flood', severity: 3,
    lat: 26.5923, lng: 127.9785,
    timestamp: NOW - 600, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },
  {
    id: 'a3', category: 'flood', severity: 4,
    lat: 26.5917, lng: 127.9775,
    timestamp: NOW - 120, issuerType: 1,
    pubkey: 'pk', signature: 'sig', note: '消防署確認済み',
  },
  {
    id: 'a4', category: 'flood', severity: 4,
    lat: 26.5925, lng: 127.9778,
    timestamp: NOW - 60, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },

  // ── クラスターB: 火災（2人・ほぼ同地点 → 小さい円）──
  {
    id: 'b1', category: 'fire', severity: 4,
    lat: 26.5940, lng: 127.9800,
    timestamp: NOW - 90, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '住宅街で火災発生',
  },
  {
    id: 'b2', category: 'fire', severity: 4,
    lat: 26.5941, lng: 127.9801,
    timestamp: NOW - 180, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },

  // ── クラスターC: 道路閉鎖（1人 → 最小円）──
  {
    id: 'c1', category: 'road_block', severity: 2,
    lat: 26.5900, lng: 127.9760,
    timestamp: NOW - 1200, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '土砂で通行止め',
  },

  // ── クラスターD: 浸水（別の場所・50m以上離れているので別クラスター）──
  {
    id: 'd1', category: 'flood', severity: 3,
    lat: 26.5880, lng: 127.9820,
    timestamp: NOW - 400, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: '別の場所でも浸水',
  },
  {
    id: 'd2', category: 'flood', severity: 3,
    lat: 26.5882, lng: 127.9822,
    timestamp: NOW - 500, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },

  // ── クラスターE: ガス漏れ（3人・広範囲 → 大きい円）──
  {
    id: 'e1', category: 'gas_leak', severity: 3,
    lat: 26.5960, lng: 127.9750,
    timestamp: NOW - 200, issuerType: 0,
    pubkey: 'pk', signature: 'sig', note: 'ガス臭あり',
  },
  {
    id: 'e2', category: 'gas_leak', severity: 3,
    lat: 26.5965, lng: 127.9758,
    timestamp: NOW - 300, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },
  {
    id: 'e3', category: 'gas_leak', severity: 4,
    lat: 26.5955, lng: 127.9745,
    timestamp: NOW - 150, issuerType: 0,
    pubkey: 'pk', signature: 'sig',
  },
]

const SELF_ID = 'userA';
type Mode = 'walk' | 'car';

type UserPos     = { id: string; lat: number; lng: number };
type Destination = { lat: number; lng: number; name: string; isShelter: boolean };

// ── 災害回避の半径（★ごと）──────────────────────
const DISASTER_RADIUS_M: Record<1 | 2 | 3, number> = {
  3: 100,  // ★★★ 高信頼 → 100m避ける
  2: 60,   // ★★☆ 中信頼 → 60m避ける
  1: 30,   // ★☆☆ 低信頼 → 30m避ける
}

// ── ユーティリティ ────────────────────────────────

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
  if (events.length === 0) return nodes
  return nodes.filter(([lng, lat]) =>
    events.every((e) => distanceM(lat, lng, e.lat, e.lng) > DISASTER_RADIUS_M[e.stars])
  )
}

function filterSafeRoads(features: any[], events: ScoredEvent[]): any[] {
  if (events.length === 0) return features
  return features.filter((f: any) => {
    const coords = f.geometry.coordinates as number[][]
    return coords.every(([lng, lat]) =>
      events.every((e) => distanceM(lat, lng, e.lat, e.lng) > DISASTER_RADIUS_M[e.stars])
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

  const [destination, setDestination] = useState<Destination | null>(null);
  const [disasterEvents, setDisasterEvents] = useState<ScoredEvent[]>([]);

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

        setUserPos({
          id: SELF_ID,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
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

  // ── TrustMap: userPosが変わったらすぐスコア再計算 ──
  useEffect(() => {
    if (!userPos) return;
    const events = trustMapEngine.computeScores(userPos.lat, userPos.lng);
    setDisasterEvents(events);
  }, [userPos]);

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

        // 災害回避: 安全なノード・道路だけに絞る
        const safeNodes = filterSafeNodes(nodes, disasterEvents);
        const safeRoads = filterSafeRoads(exploded, disasterEvents);

        // 安全なノードが極端に少ない場合はフォールバック
        const routingNodes  = safeNodes.length > 10 ? safeNodes : nodes;
        const startNode     = snapToNearestNode(snapStart, routingNodes);
        const endNode       = snapToNearestNode(snapEnd,   routingNodes);

        // 安全な道路だけでPathFinderを再構築
        const routingFinder = safeRoads.length > 10
          ? new PathFinder(turf.featureCollection(safeRoads), { precision: 1e-5 })
          : finder;

        const result = routingFinder.findPath(startNode, endNode);

        if (result?.path) {
          setDistance(Math.round(result.weight * 1000));
          const coords = result.path.map((p: number[]) => [p[1], p[0]]);

          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'drawRoute', coordinates: coords })
          );
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'updateDestinationPin',
              lat: end.lat, lng: end.lng,
              name: end.name, isShelter: end.isShelter
            })
          );
        } else {
          setDistance(null);
          Alert.alert(
            '経路が見つかりません',
            '災害エリアを避けると経路が見つかりませんでした。別の目的地を選んでください。'
          );
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

  return (
    <MobileFrame>
      <BrowserHeader />
      <AppHeader title="マップ" subtitle={headerSubText} />

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          style={styles.webview}
          source={require('../../assets/web/map.html')}
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
        />

        {isRouting && (
          <View style={styles.routingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.routingText}>経路を計算中...</Text>
          </View>
        )}

        {pfReady && webReady && (
          <>
            {disasterEvents.length > 0 && (
              <View style={styles.disasterBadge}>
                <Text style={styles.disasterBadgeText}>
                  ⚠️ {disasterEvents.length} 件の危険情報
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.locateButton, (!userPos || locLoading) && { opacity: 0.5 }]}
              onPress={handleCenterOnSelf}
              disabled={!userPos || locLoading}
            >
              <Ionicons name="locate" size={26} color="#007AFF" />
            </TouchableOpacity>

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
  disasterBadge: {
    position: 'absolute',
    top: 12,
    left: Design.spacing.lg,
    backgroundColor: '#FEF3C7',
    borderRadius: Design.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    zIndex: 15,
  },
  disasterBadgeText: {
    color: '#92400E',
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
  locateButton: {
    position: 'absolute',
    bottom: 180,
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
    bottom: 26,        // 28 → 12（下に近づける）
    left: 20,
    right: 20,
    backgroundColor: Design.colors.background,
    borderRadius: 20,
    padding: 12,       // 20 → 12（内側を小さく）
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
    marginBottom: 3,
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
