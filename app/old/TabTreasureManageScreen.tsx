import React, { useState } from "react";
import { View, TextInput, Button, Alert, ScrollView, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Treasure } from "../InteractiveMap"; // 型を再利用

// 初期データ（index.tsxと同じ）
const INITIAL_TREASURES: Treasure[] = [
  { id: 't1', lat: 26.52665030, lon: 128.03003221, qrCodeId: 'QR_TREASURE_001', status: 'unfound', point: 100 },
  { id: 't2', lat: 26.52670909, lon: 128.03054853, qrCodeId: 'QR_TREASURE_002', status: 'unfound', point: 100 },
  { id: 't3', lat: 26.52673549, lon: 128.02957221, qrCodeId: 'QR_TREASURE_003', status: 'unfound', point: 100 },
];

export default function TabTreasureManageScreen() {
  const [treasures, setTreasures] = useState<Treasure[]>(INITIAL_TREASURES);
  const [inputLat, setInputLat] = useState("");
  const [inputLon, setInputLon] = useState("");
  const [inputQrId, setInputQrId] = useState("");

  // 宝の追加
  const handleAddTreasure = () => {
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (isNaN(lat) || isNaN(lon) || !inputQrId) {
      Alert.alert("エラー", "有効な緯度、経度、およびQR IDを入力してください。");
      return;
    }

    if (treasures.some(t => t.qrCodeId === inputQrId)) {
      Alert.alert("エラー", `QR ID "${inputQrId}" は既に使用されています。`);
      return;
    }

    const newTreasure: Treasure = {
      id: Date.now().toString(),
      lat,
      lon,
      qrCodeId: inputQrId,
      status: "unfound",
      point: 100,
    };
    setTreasures(prev => [...prev, newTreasure]);
    setInputLat("");
    setInputLon("");
    setInputQrId("");
    Alert.alert("成功", "宝の座標が追加されました。");
  };

  // ソフトリセット
  const handleSoftResetTreasures = () => {
    Alert.alert("発見状態をリセット", "全て未発見に戻しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "リセット実行",
        onPress: () => setTreasures(prev => prev.map(t => ({ ...t, status: "unfound" }))),
      },
    ]);
  };

  // ハードリセット
  const handleHardResetTreasures = () => {
    Alert.alert("初期化確認", "手動追加した宝箱も削除されます。よろしいですか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "初期化実行",
        onPress: () => setTreasures(INITIAL_TREASURES),
        style: "destructive",
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <ThemedText style={styles.title}>🎒 宝箱管理</ThemedText>

        {/* 座標追加 */}
        <ThemedText style={styles.sectionTitle}>宝の座標手動追加</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 0.7 }]}
            placeholder="QR ID (例: T_001)"
            value={inputQrId}
            onChangeText={setInputQrId}
          />
          <TextInput
            style={styles.input}
            placeholder="緯度"
            value={inputLat}
            onChangeText={setInputLat}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="経度"
            value={inputLon}
            onChangeText={setInputLon}
            keyboardType="numeric"
          />
          <Button title="登録" onPress={handleAddTreasure} />
        </View>

        {/* リセット */}
        <View style={styles.resetButtons}>
          <Button title="発見状態リセット" onPress={handleSoftResetTreasures} color="#FFC107" />
          <View style={{ width: 10 }} />
          <Button title="リスト初期化" onPress={handleHardResetTreasures} color="#D32F2F" />
        </View>

        {/* 宝箱リスト */}
        <ThemedText style={styles.sectionTitle}>登録済み宝箱</ThemedText>
        {treasures.map((t, i) => (
          <View key={t.id} style={styles.listItem}>
            <ThemedText style={styles.listText}>
              {i + 1}. {t.qrCodeId} ({t.lat.toFixed(4)}, {t.lon.toFixed(4)}) [{t.status}]
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginVertical: 10 },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 5, marginRight: 5, paddingHorizontal: 8, height: 40 },
  resetButtons: { flexDirection: "row", justifyContent: "center", marginVertical: 10 },
  listItem: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eee" },
  listText: { fontSize: 13 },
});
