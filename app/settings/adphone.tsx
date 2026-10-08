import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DeliveryStatusLabel } from "@/components/DeliveryStatusLabel";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Design } from "@/constants/Design";
import { BleDevice, BleState } from "@/lib/ble2";
import { useBleContext } from "@/contexts/BleContext";

// ─── 接続状態バッジ ────────────────────────────────────────────────────────────
const STATE_CONFIG: Record<BleState, { label: string; color: string }> = {
  disconnected: { label: "未接続",    color: Design.colors.textMuted },
  scanning:     { label: "スキャン中", color: Design.colors.warning },
  connecting:   { label: "接続中",    color: Design.colors.primary },
  connected:    { label: "接続済み",  color: Design.colors.success },
};

function StateBadge({ state }: { state: BleState }) {
  const { label, color } = STATE_CONFIG[state];
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

// ─── デバイスリストアイテム ────────────────────────────────────────────────────
type DeviceItemProps = {
  device: BleDevice;
  connectingId: string | null;
  onConnect: (id: string) => void;
};

function DeviceItem({ device, connectingId, onConnect }: DeviceItemProps) {
  const isConnecting = connectingId === device.id;
  const isDisabled = connectingId !== null;

  return (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name ?? "不明なデバイス"}</Text>
        <Text style={styles.deviceId}>{device.id}</Text>
        <Text style={styles.deviceRssi}>
          {device.rssi != null ? `${device.rssi} dBm` : "RSSI 不明"}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          styles.btnPrimary,
          isDisabled && styles.btnDisabled,
        ]}
        onPress={() => onConnect(device.id)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color={Design.colors.white} />
        ) : (
          <Text style={styles.buttonText}>接続</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── メイン画面 ────────────────────────────────────────────────────────────────
export default function AdphoneSettingsScreen() {
  const {
    bleState,
    receivedMessages,
    connectedCount,
    discoveredDevices,
    startScan,
    connectToDevice,
    disconnect,
    sendText,
    deliveryStatus,
    piInfo,
    nodes,
    requestNodes,
  } = useBleContext();

  const [inputText, setInputText] = useState("");
  const [destText, setDestText] = useState("");
  const [destError, setDestError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const isConnected = bleState === "connected";
  const isScanning = bleState === "scanning";
  const showDeviceList =
    (isScanning || bleState === "disconnected") &&
    !isConnected &&
    (isScanning || discoveredDevices.length > 0);

  const handleConnect = async (deviceId: string) => {
    setConnectingId(deviceId);
    await connectToDevice(deviceId);
    setConnectingId(null);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    const dest = destText.trim();
    let to: number | undefined;
    if (dest) {
      to = Number(dest);
      if (!/^\d+$/.test(dest) || to > 65534) {
        setDestError("送信先は 0〜65534 の半角数字で入力してください");
        return;
      }
    }
    setDestError(null);
    setLastKey(await sendText(text, { to }));
    setInputText("");
  };

  return (
    <ScreenLayout title="ADREN 連携" subtitle="BLE テスト" showBack>
      {/* ── 接続状態 & 台数 ─────────────────────────────────────────────────── */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusLabel}>状態</Text>
          <StateBadge state={bleState} />
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.statusLabel}>接続台数</Text>
          <Text style={styles.countText}>{connectedCount} 台</Text>
        </View>
      </View>

      {/* ── 操作ボタン ────────────────────────────────────────────────────────── */}
      <View style={styles.buttonRow}>
        {bleState === "disconnected" && (
          <TouchableOpacity
            style={[styles.button, styles.btnPrimary]}
            onPress={startScan}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>
              {discoveredDevices.length > 0 ? "再スキャン" : "スキャン開始"}
            </Text>
          </TouchableOpacity>
        )}
        {isScanning && (
          <View style={[styles.button, styles.btnDisabled, styles.scanningBtn]}>
            <ActivityIndicator
              size="small"
              color={Design.colors.white}
              style={styles.spinnerMargin}
            />
            <Text style={styles.buttonText}>スキャン中…</Text>
          </View>
        )}
        {isConnected && (
          <TouchableOpacity
            style={[styles.button, styles.btnDanger]}
            onPress={disconnect}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>切断</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── スキャン結果リスト ────────────────────────────────────────────────── */}
      {showDeviceList && (
        <View style={styles.deviceSection}>
          <Text style={styles.sectionTitle}>
            {isScanning
              ? `デバイスを探しています… (${discoveredDevices.length} 件)`
              : `見つかったデバイス (${discoveredDevices.length} 件)`}
          </Text>
          {discoveredDevices.length === 0 ? (
            <View style={styles.emptyDevice}>
              <ActivityIndicator size="small" color={Design.colors.textMuted} />
              <Text style={styles.emptyDeviceText}>中継局（Adphone）を検索中…</Text>
            </View>
          ) : (
            discoveredDevices.map((device: BleDevice) => (
              <DeviceItem
                key={device.id}
                device={device}
                connectingId={connectingId}
                onConnect={handleConnect}
              />
            ))
          )}
        </View>
      )}

      {/* ── 接続済みUI（送受信） ─────────────────────────────────────────────── */}
      {isConnected && (
        <>
          {piInfo && (
            <Text style={styles.piInfo}>
              {`中継局 ${piInfo.addr}${piInfo.name ? `（${piInfo.name}）` : ""} — 経路: ${
                piInfo.routing ?? "?"
              } / グループ鍵: ${piInfo.group ? "あり" : "なし"}`}
            </Text>
          )}
          <TextInput
            style={[styles.input, styles.destInput]}
            value={destText}
            onChangeText={setDestText}
            placeholder="送信先アドレス（半角数字、省略=ブロードキャスト）"
            placeholderTextColor={Design.colors.textMuted}
            keyboardType="number-pad"
            returnKeyType="next"
          />
          <View style={styles.sendRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="送信テキストを入力"
              placeholderTextColor={Design.colors.textMuted}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.button, styles.btnSuccess]}
              onPress={handleSend}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>送信</Text>
            </TouchableOpacity>
          </View>
          {destError && <Text style={styles.errorText}>{destError}</Text>}
          {lastKey && deliveryStatus[lastKey] && (
            <DeliveryStatusLabel info={deliveryStatus[lastKey]} align="left" />
          )}

          <View style={styles.nodesHeader}>
            <Text style={styles.logTitle}>メッシュのノード（{nodes.length}）</Text>
            <TouchableOpacity onPress={requestNodes} activeOpacity={0.7}>
              <Text style={styles.linkText}>更新</Text>
            </TouchableOpacity>
          </View>
          {nodes.map((n) => (
            <Text key={n.addr} style={styles.nodeText}>
              {`${n.addr}  ${n.name || "（名前なし）"}  ${n.role}  ${
                n.hops != null ? `${n.hops} ホップ` : ""
              }`}
            </Text>
          ))}

          <Text style={styles.logTitle}>受信ログ（Pi→App）</Text>
          <FlatList
            style={styles.logList}
            data={receivedMessages}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => (
              <View style={styles.logItem}>
                <Text style={styles.logIndex}>{receivedMessages.length - index}</Text>
                <Text style={styles.logText}>{item}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.logEmpty}>受信メッセージなし</Text>
            }
          />
        </>
      )}
    </ScreenLayout>
  );
}

// ─── スタイル ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  piInfo: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    marginBottom: Design.spacing.sm,
  },
  errorText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.danger,
    marginTop: 4,
  },
  nodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.primary,
    paddingVertical: Design.spacing.sm,
  },
  nodeText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.text,
    paddingVertical: 2,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    marginBottom: Design.spacing.md,
  },
  statusLeft: {
    alignItems: "flex-start",
    gap: Design.spacing.xs,
  },
  statusRight: {
    alignItems: "flex-end",
    gap: Design.spacing.xs,
  },
  statusLabel: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.normal,
  },
  badge: {
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 4,
    borderRadius: Design.radius.full,
  },
  badgeText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.caption,
  },
  countText: {
    fontSize: Design.fontSize.bodyLarge,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.success,
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: Design.spacing.md,
  },
  button: {
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scanningBtn: {
    gap: Design.spacing.xs,
  },
  spinnerMargin: {
    marginRight: Design.spacing.xs,
  },
  btnPrimary: { backgroundColor: Design.colors.primary },
  btnDanger:  { backgroundColor: Design.colors.danger },
  btnSuccess: { backgroundColor: Design.colors.success },
  btnDisabled: {
    backgroundColor: Design.colors.border,
    opacity: 0.8,
  },
  buttonText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  // ── デバイスリスト ───────────────────────────────────────────────────────────
  deviceSection: {
    marginBottom: Design.spacing.md,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.surface,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Design.colors.border,
  },
  emptyDevice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.lg,
  },
  emptyDeviceText: {
    color: Design.colors.textMuted,
    fontSize: Design.fontSize.body,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Design.colors.borderLight,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
    paddingRight: Design.spacing.md,
  },
  deviceName: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  deviceId: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  deviceRssi: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textSecondary,
  },
  // ── 送受信UI ─────────────────────────────────────────────────────────────────
  destInput: {
    marginBottom: Design.spacing.sm,
  },
  sendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    marginBottom: Design.spacing.md,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.md,
    color: Design.colors.text,
    backgroundColor: Design.colors.surface,
    fontSize: Design.fontSize.body,
  },
  logTitle: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.semi,
    marginBottom: Design.spacing.xs,
  },
  logList: {
    flex: 1,
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: Design.colors.border,
    padding: Design.spacing.sm,
  },
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Design.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Design.colors.borderLight,
    gap: Design.spacing.sm,
  },
  logIndex: {
    color: Design.colors.textMuted,
    fontSize: Design.fontSize.caption,
    width: 24,
    textAlign: "right",
    marginTop: 1,
  },
  logText: {
    flex: 1,
    color: Design.colors.text,
    fontSize: Design.fontSize.caption,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  logEmpty: {
    color: Design.colors.textMuted,
    textAlign: "center",
    marginTop: Design.spacing.xl,
    fontSize: Design.fontSize.body,
  },
});
