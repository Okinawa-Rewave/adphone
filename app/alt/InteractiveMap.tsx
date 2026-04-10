// app/InteractiveMap.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import * as Location from "expo-location";

import { MobileFrame } from "@/components/MobileFrame";
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";
import { InteractiveMap } from "@/components/InteractiveMap";

export default function InteractiveMapScreen() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("位置情報の権限がありません。設定から許可してください。");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
      });
    })();
  }, []);

  const subtitle = useMemo(() => {
    if (error) return error;
    if (!location) return "現在地を取得中…";
    return `現在地: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
  }, [location, error]);

  return (
    <MobileFrame>
      {/* ① Webブラウザ風ヘッダー */}
      <BrowserHeader />

      {/* ② アプリ風ヘッダー */}
      <AppHeader
        title="マップ"
        subtitle={subtitle}
      />

      {/* 地図本体 */}
      <View style={styles.mapArea}>
        {location ? (
          <InteractiveMap
            latitude={location.lat}
            longitude={location.lon}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>地図を準備中…</Text>
          </View>
        )}
      </View>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
  mapArea: {
    flex: 1,
    backgroundColor: "#000000ff",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },
});
