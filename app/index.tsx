// app/index.tsx
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { MobileFrame } from '@/components/MobileFrame';
import { NavButton } from '@/components/NavButton';
import {
  MessageSquare,
  Map as MapIcon,
  Camera,
  Settings,
  Bot,
  Bell,
} from 'lucide-react-native';
import { BrowserHeader } from "@/components/BrowserHeader";
import React, { useState, useRef } from 'react';



export default function HomeScreen() {
  //更新ボタン用の定数
  const MIN_SPIN_MS = 500;
  const SUCCESS_PULSE_MS = 600;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccessPulse, setRefreshSuccessPulse] = useState(false);
  const refreshStartedAtRef = useRef<number | null>(null);

  const stopRefreshingSuccess = () => {
    const startedAt = refreshStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, MIN_SPIN_MS - elapsed);

    setTimeout(() => {
      setRefreshing(false);
      refreshStartedAtRef.current = null;

      setRefreshSuccessPulse(true);
      setTimeout(() => setRefreshSuccessPulse(false), SUCCESS_PULSE_MS);
    }, remaining);
  };//ここまで更新ボタン用


  return (
    <MobileFrame isOnline={true}>
      {/* ヘッダー */}
      <BrowserHeader
        refreshing={refreshing}
        refreshSuccessPulse={refreshSuccessPulse}
        onRefresh={() => {
          refreshStartedAtRef.current = Date.now();
          setRefreshSuccessPulse(false);
          setRefreshing(true);

          // ★ 今は「再取得した想定」で少し待つ
          setTimeout(() => {
            // 将来ここを実データ取得に置き換える
            stopRefreshingSuccess();
          }, 100);
        }}
      />


      {/* ★ ここは固定エリア（上部30%） */}
      <View style={styles.notificationArea}>
        <View style={styles.notificationList}>
          <View style={styles.notificationRow}>
            <Text style={styles.notificationText}>
              • ◯◯さんからメッセージを受信しました
            </Text>
            <Text style={styles.notificationTime}>XX:XX</Text>
          </View>

          <View style={styles.notificationRow}>
            <Text style={styles.notificationText}>
              • ××にメッセージを送信しました
            </Text>
            <Text style={styles.notificationTime}>XX:XX</Text>
          </View>

          <View style={styles.notificationRow}>
            <Text style={styles.notificationText}>
              • ネットワークに接続しました
            </Text>
            <Text style={styles.notificationTime}>XX:XX</Text>
          </View>

        </View>
      </View>

      {/* ★ 下部だけスクロール可能に */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          <NavButton
            href="/chat"
            icon={<MessageSquare size={128} strokeWidth={1.0} color="#111827" />}
            label="チャット"
            badge={1}
          />

          <NavButton
            href="/InteractiveMap"
            icon={<MapIcon size={128} strokeWidth={1.0} color="#111827" />}
            label="マップ"
          />

          <NavButton
            href="/camera"
            icon={<Camera size={128} strokeWidth={1.0} color="#111827" />}
            label="カメラ"
          />

          <NavButton
            href="/settings"
            icon={<Settings size={128} strokeWidth={1.0} color="#111827" />}
            label="かんたん設定"
          />
        </View>

        <View style={[styles.grid, styles.gridBottom]}>
          <NavButton
            href="/ai"
            icon={<Bot size={128} strokeWidth={1.0} color="#111827" />}
            label="AI"
          />

          <NavButton
            href="/notifications"
            icon={<Bell size={128} strokeWidth={1.0} color="#111827" />}
            label="通知"
            badge={3}
          />
        </View>
      </ScrollView>
    </MobileFrame>
  );
}


const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  notificationArea: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    // 画面高さの 30% を固定エリアに
    height: Dimensions.get("window").height * 0.30,
  },
  notificationList: {
    gap: 4,
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notificationText: {
    fontSize: 18,
    color: '#6b7280',
    flexShrink: 1,
    paddingRight: 8,
  },
  notificationTime: {
    fontSize: 18,
    color: '#9ca3af',
  },
  notificationDot: {
    fontSize: 10,
    color: '#9ca3af',
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridBottom: {
    paddingBottom: 16,
  },
});
