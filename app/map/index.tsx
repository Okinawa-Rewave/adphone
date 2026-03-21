import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Design } from '@/constants/Design';
import { BrowserHeader } from '@/components/BrowserHeader';
import { AppHeader } from '@/components/AppHeader';
import { MobileFrame } from '@/components/MobileFrame';

import * as turf from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import PathFinder from 'geojson-path-finder';
import { WebView } from 'react-native-webview';

import * as Location from 'expo-location';

import integratedRoadData from '../../assets/roads_all.json';
import shelterData from '../../assets/shelters.json';

const SELF_ID = 'userA';
type Mode = 'walk' | 'car';

type UserPos = { id: string; lat: number; lng: number };
type Destination = { lat: number; lng: number; name: string; isShelter: boolean };

export default function App() {
  const webViewRef = useRef<WebView>(null);

  const [mode, setMode] = useState<Mode>('walk');
  const [pfReady, setPfReady] = useState(false);
  const [webReady, setWebReady] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const [walkFinder, setWalkFinder] = useState<any>(null);
  const [carFinder, setCarFinder] = useState<any>(null);
  const [walkNodes, setWalkNodes] = useState<number[][]>([]);
  const [carNodes, setCarNodes] = useState<number[][]>([]);

  // ✅ 現在地はexpo-locationで取得する（初期は null）
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  const [destination, setDestination] = useState<Destination | null>(null);

  // --- 道路ネットワーク構築 ---
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
      if (d < min) {
        min = d;
        nearest = n;
      }
    });
    return turf.point(nearest);
  }

  // ✅ expo-location: 権限→現在地取得
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

  // ✅ 道路ネットワーク初期化
  useEffect(() => {
    try {
      const allFeatures = (integratedRoadData as any).features ?? [];

      const walkRaw = allFeatures.filter(
        (f: any) =>
          f.properties?.highway && f.properties.highway !== 'motorway'
      );
      const carRaw = allFeatures.filter(
        (f: any) =>
          f.properties?.highway &&
          !['footway', 'steps', 'pedestrian'].includes(f.properties.highway)
      );

      const walkExp = explodeMultiLineStrings(walkRaw);
      const carExp = explodeMultiLineStrings(carRaw);

      setWalkFinder(new PathFinder(turf.featureCollection(walkExp), { precision: 1e-5 }));
      setWalkNodes(extractNodes(walkExp));

      setCarFinder(new PathFinder(turf.featureCollection(carExp), { precision: 1e-5 }));
      setCarNodes(extractNodes(carExp));

      setPfReady(true);
    } catch (e) {
      Alert.alert('エラー', 'データの初期化に失敗しました');
    }
  }, []);

  // ✅ WebViewが準備できた＆現在地が取れたら、地図へユーザー位置を送る
  useEffect(() => {
    if (!webReady) return;
    if (!userPos) return;

    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'updateUsers', users: [userPos] })
    );
  }, [webReady, userPos]);

  // --- 経路探索実行 ---
  const findRoute = (start: UserPos, end: Destination) => {
    const isWalk = mode === 'walk';
    const finder = isWalk ? walkFinder : carFinder;
    const nodes = isWalk ? walkNodes : carNodes;
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
        const roads = turf.featureCollection(explodeMultiLineStrings(currentRaw));

        const snapStart = nearestPointOnLine(roads, turf.point([start.lng, start.lat]));
        const snapEnd = nearestPointOnLine(roads, turf.point([end.lng, end.lat]));
        const startNode = snapToNearestNode(snapStart, nodes);
        const endNode = snapToNearestNode(snapEnd, nodes);

        const result = finder.findPath(startNode, endNode);

        if (result && result.path) {
          setDistance(Math.round(result.weight * 1000));
          const coords = result.path.map((p: number[]) => [p[1], p[0]]);

          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'drawRoute', coordinates: coords })
          );
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'updateDestinationPin',
              lat: end.lat,
              lng: end.lng,
              name: end.name,
              isShelter: end.isShelter
            })
          );
        } else {
          setDistance(null);
        }
      } catch (err) {
        console.error('Routing Error:', err);
      } finally {
        setIsRouting(false);
      }
    }, 10);
  };

  // 目的地がある時だけ経路探索
  useEffect(() => {
    if (!pfReady || !webReady) return;
    if (!destination) return;
    if (!userPos) return;

    findRoute(userPos, destination);
  }, [pfReady, webReady, mode, destination, userPos]);

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
      if (d < minD) {
        minD = d;
        closest = s;
      }
    });

    if (closest) {
      setDestination({ lat: closest.lat, lng: closest.lng, name: closest.name, isShelter: true });
    }
  };

  const handleCenterOnSelf = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'centerOnSelf' }));
  };

  // ✅ ヘッダー2段目の表示文言
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
      <AppHeader
        title="マップ"
        subtitle={headerSubText}
      />

      <View style={styles.mapContainer}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        source={require('../../assets/web/map.html')}
        showsVerticalScrollIndicator={false}
        onLoadEnd={() => {
          setWebReady(true);

          // shelters は WebView ready 時に送る
          webViewRef.current?.postMessage(
            JSON.stringify({ type: 'updateShelters', shelters: shelterData })
          );

          // userPos がすでにあるならここでも送る（useEffectでも送るので保険）
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
  webview: { flex: 1 },

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
  locateButton: {
    position: 'absolute',
    bottom: 220,
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
    bottom: Design.spacing.xxl,
    left: Design.spacing.lg,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    padding: Design.spacing.lg,
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
    marginBottom: Design.spacing.lg,
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
  modeBtnText: {
    color: Design.colors.text,
  },
});
