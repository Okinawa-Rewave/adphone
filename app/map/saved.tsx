import { AppBar } from '@/components/AppBar';
import { MobileFrame } from '@/components/MobileFrame';
import { Design } from '@/constants/Design';
import { clearMapSaveHistory, loadMapSaveHistory, removeMapSaveHistoryItem, type MapSaveHistoryItem } from '@/lib/mapSaveHistory';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PENDING_DL_KEY = '@map_pending_dl';

function toJaDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ja-JP', { hour12: false });
}

function statusLabel(status: MapSaveHistoryItem['status']): string {
  if (status === 'success') return '保存完了';
  if (status === 'failed') return '失敗';
  if (status === 'removed') return '削除';
  return '完了';
}

function statusColor(status: MapSaveHistoryItem['status']): string {
  if (status === 'success') return '#16A34A';
  if (status === 'failed') return '#DC2626';
  if (status === 'removed') return '#94A3B8';
  return '#64748B';
}

export default function MapSavedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MapSaveHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const list = await loadMapSaveHistory();
    setItems(list);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const onDeleteOne = (id: string) => {
    Alert.alert('履歴を削除', 'この履歴を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeMapSaveHistoryItem(id);
          await reload();
        },
      },
    ]);
  };

  const onDeleteAll = () => {
    Alert.alert('履歴を全削除', '保存履歴をすべて削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await clearMapSaveHistory();
          await reload();
        },
      },
    ]);
  };

  const startJapanDownload = async (maxZoom: number) => {
    await AsyncStorage.setItem(PENDING_DL_KEY, JSON.stringify({ maxZoom }));
    router.push('/map' as any);
  };

  const onDownloadJapan = () => {
    Alert.alert(
      '日本全国オフラインDL',
      'ズームレベルを選択してください。\n・z10（標準）: 約30〜50MB、WiFi推奨\n・z12（高解像度）: 約400MB、時間がかかります',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'z10（標準）', onPress: () => startJapanDownload(10) },
        { text: 'z12（高解像度）', onPress: () => startJapanDownload(12) },
      ]
    );
  };

  return (
    <MobileFrame>
      <AppBar title="保存履歴" showBack />

      {/* ヘッダアクション行 */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.dlBtn} onPress={onDownloadJapan}>
          <Ionicons name="cloud-download-outline" size={14} color="#1D4ED8" />
          <Text style={styles.dlBtnText}>日本全国をDL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={onDeleteAll} disabled={items.length === 0}>
          <Text style={[styles.clearBtnText, items.length === 0 && { opacity: 0.4 }]}>全削除</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={40} color={Design.colors.textMuted} />
            <Text style={styles.emptyText}>保存履歴はまだありません</Text>
            <Text style={styles.emptyHint}>マップ右上の「💾」ボタンで現在のエリアを保存できます</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20', borderColor: statusColor(item.status) + '60' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.time}>{toJaDateTime(item.savedAt)}</Text>
              </View>

              {/* 座標プレースホルダー */}
              {typeof item.centerLat === 'number' && typeof item.centerLng === 'number' && (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map" size={24} color="#94A3B8" />
                  <View>
                    <Text style={styles.placeholderText}>
                      {item.centerLat.toFixed(4)}, {item.centerLng.toFixed(4)}
                    </Text>
                    <Text style={styles.placeholderZoom}>ズーム z{Math.round(item.zoom ?? 14)}</Text>
                  </View>
                </View>
              )}

              {typeof item.savedTiles === 'number' && (
                <Text style={styles.tiles}>💾 {item.savedTiles.toLocaleString()}枚保存済み</Text>
              )}

              {!!item.message && <Text style={styles.message}>{item.message}</Text>}

              <View style={styles.cardActions}>
                {typeof item.centerLat === 'number' && typeof item.centerLng === 'number' && (
                  <TouchableOpacity
                    style={styles.openMapBtn}
                    onPress={() => router.push(
                      `/map?lat=${item.centerLat}&lng=${item.centerLng}&zoom=${item.zoom ?? 14}` as any
                    )}
                  >
                    <Ionicons name="navigate-outline" size={13} color="#1D4ED8" />
                    <Text style={styles.openMapBtnText}>この地点を開く</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.deleteOneBtn} onPress={() => onDeleteOne(item.id)}>
                  <Text style={styles.deleteOneBtnText}>削除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    backgroundColor: Design.colors.background,
    gap: 8,
  },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dlBtnText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 12,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  clearBtnText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    padding: Design.spacing.md,
    gap: Design.spacing.sm,
  },
  empty: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: Design.colors.textMuted,
    fontSize: Design.fontSize.body,
    fontWeight: '600',
  },
  emptyHint: {
    color: Design.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Design.colors.background,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 12,
  },
  time: {
    fontSize: 12,
    color: Design.colors.textMuted,
  },
  mapPlaceholder: {
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderZoom: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  tiles: {
    color: Design.colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  message: {
    color: Design.colors.textMuted,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  openMapBtnText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 11,
  },
  deleteOneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteOneBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 11,
  },
});
