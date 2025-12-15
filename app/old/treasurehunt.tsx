import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { connectToDevice, disconnectDevice } from '@/lib/Ble';
import { insertMyLocation } from '@/lib/db';
import React, { useState, useCallback } from 'react';
import { StyleSheet, Switch, View, Button, Modal, Alert, ScrollView } from 'react-native';
import InteractiveMap from '../InteractiveMap';
import QrScannerModal from './QrScannerModal';
import { useTreasures } from './TreasureContext'; // Context共有

export default function TabOneScreen() {
  const { treasures, setTreasures, resetStatus, resetAll } = useTreasures();

  const [isEnabled, setIsEnabled] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);

  // BLE接続
  const handleSwitchChange = async (value: boolean) => {
    setIsEnabled(value);
    if (value) {
      try {
        await connectToDevice({
          onLocationReceived: async (lat: number, lon: number) => {
            setLatitude(lat);
            setLongitude(lon);
            await insertMyLocation(lat, lon);
            console.log(`📍 位置情報をDBに保存: lat=${lat}, lon=${lon}`);
          },
        });
      } catch (error) {
        console.error('BLE接続失敗:', error);
        setIsEnabled(false);
      }
    } else {
      await disconnectDevice();
      setLatitude(null);
      setLongitude(null);
    }
  };

  // 宝発見処理
  const handleTreasureFound = useCallback(
    (id: string) => {
      setTreasures(prev =>
        prev.map(t =>
          t.id === id && t.status === 'unfound'
            ? { ...t, status: 'found' }
            : t
        )
      );
    },
    [setTreasures]
  );

  // ワクワクメッセージ
  const treasureMessages: Record<string, string> = {
    QR_TREASURE_001: '⚡ 強力なエネルギーを感じる…！',
    QR_TREASURE_002: '💎 まばゆい宝石が光り輝いている！',
    QR_TREASURE_003: '🐉 伝説のドラゴンの鱗を発見した！',
    QR_TREASURE_004: '📜 不思議な地図を見つけた！次の手がかりか？',
    QR_TREASURE_005: '🗝️ 古びた宝箱の中に金貨がぎっしり！',
  };

  // QRコード読み取り時
  const handleQrCodeScanned = useCallback(
    (qrData: string) => {
      setIsQrModalVisible(false);

      const targetTreasure = treasures.find(
        t => t.qrCodeId === qrData && t.status === 'unfound'
      );

      if (targetTreasure) {
        handleTreasureFound(targetTreasure.id);
        const message =
          treasureMessages[targetTreasure.qrCodeId] ??
          '✨ 謎めいた光があなたを包む…！';
        Alert.alert('🎉 宝発見！', `${targetTreasure.qrCodeId} の宝箱を開けた！\n${message}`);
        return;
      }

      const foundTreasure = treasures.find(
        t => t.qrCodeId === qrData && t.status === 'found'
      );
      if (foundTreasure) {
        Alert.alert('発見済み', `宝箱 ${qrData} はすでに発見されています。`);
      } else {
        Alert.alert('無効なQR', `対応する宝箱が見つかりません: ${qrData}`);
      }
    },
    [treasures, handleTreasureFound]
  );

  const isMapReady = isEnabled && latitude !== null && longitude !== null;

  // 💡 発見状態リセット
  const handleSoftReset = () => {
    Alert.alert('確認', '全ての宝箱を「未発見」に戻しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'リセット', onPress: () => resetStatus() },
    ]);
  };

  // 💡 全リスト初期化
  const handleHardReset = () => {
    Alert.alert('確認', '宝箱リストを初期状態に戻しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '初期化', onPress: () => resetAll(), style: 'destructive' },
    ]);
  };

  return (
    <ThemedView style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>高専祭トレジャーハント</ThemedText>

          {/* BLE接続スイッチ */}
          <View style={styles.row}>
            <ThemedText style={styles.label}>GPS/BLE接続</ThemedText>
            <Switch value={isEnabled} onValueChange={handleSwitchChange} style={styles.switch} />
          </View>

          {/* 現在地表示 */}
          {isMapReady && (
            <View style={styles.coordDisplay}>
              <ThemedText style={styles.coordText}>
                現在地: Lat {latitude!.toFixed(6)}, Lon {longitude!.toFixed(6)}
              </ThemedText>
            </View>
          )}

          {/* QRスキャンボタン */}
          <Button title="宝のQRコードをスキャン" onPress={() => setIsQrModalVisible(true)} color="#4CAF50" />
        </View>

        {/* 地図表示 */}
        <View style={styles.mapArea}>
          {isMapReady ? (
            <InteractiveMap
              latitude={latitude!}
              longitude={longitude!}
              treasures={treasures}
              onTreasureFound={handleTreasureFound}
            />
          ) : (
            <ThemedView style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>
                {isEnabled ? 'GPS座標を受信中...' : 'BLE接続をONにしてください'}
              </ThemedText>
            </ThemedView>
          )}
        </View>

        {/* 🔁 リセットボタン */}
        <View style={styles.resetButtons}>
          <Button title="発見状態をリセット" onPress={handleSoftReset} color="#FFC107" />
          <View style={{ width: 10 }} />
          <Button title="リスト全体を初期化" onPress={handleHardReset} color="#D32F2F" />
        </View>

        {/* 発見状況表示 */}
        <ThemedView style={styles.treasureListContainer}>
          <ThemedText style={styles.listTitle}>宝箱の発見状況</ThemedText>
          {treasures.map((t, index) => (
            <View key={t.id} style={styles.listItem}>
              <ThemedText style={styles.listItemText}>
                {index + 1}. {t.qrCodeId} ({t.status === 'found' ? '発見済み' : '未発見'})
              </ThemedText>
            </View>
          ))}
        </ThemedView>
      </ScrollView>

      {/* QRスキャナー */}
      <Modal
        visible={isQrModalVisible}
        onRequestClose={() => setIsQrModalVisible(false)}
        animationType="slide"
      >
        <QrScannerModal
          onScanSuccess={handleQrCodeScanned}
          onClose={() => setIsQrModalVisible(false)}
        />
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, paddingTop: 40, paddingHorizontal: 15 },
  scrollContent: { paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  header: { alignItems: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingVertical: 5 },
  label: { fontSize: 18 },
  switch: { transform: [{ scale: 1.2 }] },
  coordDisplay: { alignItems: 'center', marginVertical: 8 },
  coordText: { fontSize: 14, color: '#666' },
  mapArea: { flex: 1, borderTopWidth: 1, borderTopColor: '#ccc', marginTop: 10, height: 250 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#999' },
  resetButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  treasureListContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  listTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  listItem: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listItemText: { fontSize: 13 },
});
