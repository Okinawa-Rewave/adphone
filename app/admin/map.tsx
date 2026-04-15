/**
 * app/admin/map.tsx
 * 自治体ポータル — 災害マップ（信頼度カラーで可視化）
 */
import { useMemo } from "react";
import { useRouter } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useNotifications, type TrustLevel } from "@/contexts/NotificationContext";
import { Design } from "@/constants/Design";

// 信頼度 → マーカー色
const TRUST_COLORS: Record<TrustLevel, string> = {
  official:   "#0f74c5",
  verified:   "#189a30",
  partial:    "#dba400",
  unverified: "#d41101",
};

// 区名 → 近似座標（デモ用）
const WARD_COORDS: Record<string, [number, number]> = {
  "渋谷区":   [35.6580, 139.7016],
  "世田谷区": [35.6467, 139.6534],
  "新宿区":   [35.6938, 139.7036],
  "港区":     [35.6581, 139.7514],
  "中央区":   [35.6685, 139.7725],
  "千代田区": [35.6940, 139.7536],
  "品川区":   [35.6090, 139.7299],
  "目黒区":   [35.6329, 139.7158],
  "大田区":   [35.5614, 139.7160],
  "杉並区":   [35.6994, 139.6366],
  "練馬区":   [35.7357, 139.6516],
  "板橋区":   [35.7509, 139.7093],
  "荒川区":   [35.7362, 139.7833],
  "足立区":   [35.7754, 139.8044],
  "江戸川区": [35.7067, 139.8688],
  "葛飾区":   [35.7475, 139.8471],
  "江東区":   [35.6721, 139.8172],
  "墨田区":   [35.7101, 139.8014],
  "台東区":   [35.7127, 139.7810],
  "文京区":   [35.7080, 139.7519],
  "豊島区":   [35.7295, 139.7180],
  "北区":     [35.7528, 139.7334],
};

function parseCoords(location?: string): [number, number] | null {
  if (!location) return null;
  // "lat, lon" 形式を試みる
  const parts = location.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  // 区名で検索
  for (const [ward, coords] of Object.entries(WARD_COORDS)) {
    if (location.includes(ward)) return coords;
  }
  return null;
}

export default function AdminMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useNotifications();

  const events = useMemo(() => {
    return items
      .filter((x) => x.disasterType)
      .flatMap((item) => {
        const coords = parseCoords(item.location);
        if (!coords) return [];
        return [
          {
            lat: coords[0],
            lng: coords[1],
            color: item.trustLevel ? TRUST_COLORS[item.trustLevel] : "#6b7280",
            type: item.disasterType ?? "other",
            text: item.text.slice(0, 80),
            score: item.trustScore ?? 0,
            author: item.author ?? "不明",
            trustLabel:
              item.trustLevel === "official"
                ? "公式"
                : item.trustLevel === "verified"
                ? "確認済"
                : item.trustLevel === "partial"
                ? "一部確認"
                : "未確認",
          },
        ];
      });
  }, [items]);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
    #map { height: 100vh; width: 100%; }
    .legend {
      position: fixed;
      bottom: 16px;
      right: 10px;
      background: rgba(255,255,255,0.95);
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      line-height: 1.6;
    }
    .legend-title { font-weight: bold; margin-bottom: 4px; font-size: 11px; color: #555; }
    .legend-row { display: flex; align-items: center; gap: 7px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .popup-title { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
    .popup-trust { font-size: 12px; margin-bottom: 4px; padding: 2px 8px; border-radius: 10px; display: inline-block; color: white; }
    .popup-body { font-size: 12px; color: #333; margin-bottom: 4px; }
    .popup-meta { font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="legend-title">信頼度</div>
    <div class="legend-row"><div class="dot" style="background:#0f74c5"></div>公式</div>
    <div class="legend-row"><div class="dot" style="background:#189a30"></div>確認済</div>
    <div class="legend-row"><div class="dot" style="background:#dba400"></div>一部確認</div>
    <div class="legend-row"><div class="dot" style="background:#d41101"></div>未確認</div>
  </div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([35.665, 139.695], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    const events = ${JSON.stringify(events)};

    if (events.length === 0) {
      const info = L.control({ position: 'topright' });
      info.onAdd = function() {
        const d = L.DomUtil.create('div');
        d.innerHTML = '<div style="background:white;padding:8px 12px;border-radius:8px;font-size:13px;color:#666;">表示できる報告がありません</div>';
        return d;
      };
      info.addTo(map);
    }

    events.forEach(function(e) {
      const marker = L.circleMarker([e.lat, e.lng], {
        color: e.color,
        fillColor: e.color,
        fillOpacity: 0.85,
        radius: 14,
        weight: 2.5,
      });
      marker.bindPopup(
        '<div class="popup-title">' + e.type + '</div>' +
        '<span class="popup-trust" style="background:' + e.color + '">' + e.trustLabel + '</span>' +
        '<div class="popup-body">' + e.text + '</div>' +
        '<div class="popup-meta">投稿者: ' + e.author + ' · 信頼度 ' + e.score + '</div>'
      );
      marker.addTo(map);
    });

    // 全マーカーが表示されるようにズームを調整
    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(function(e) { return [e.lat, e.lng]; }));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <ChevronLeft size={20} color={Design.colors.text} strokeWidth={2.2} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>災害マップ</Text>
        <Text style={styles.countLabel}>{events.length}件</Text>
      </View>

      <WebView
        source={{ html }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    minHeight: 52,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    fontWeight: Design.fontWeight.semi,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  countLabel: {
    width: 60,
    textAlign: "right",
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
  },
  map: { flex: 1 },
});
