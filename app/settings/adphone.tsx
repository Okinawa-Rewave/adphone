// app/settings/adphone.tsx
import { ScreenLayout } from "@/components/ScreenLayout";
import { Design } from "@/constants/Design";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// BLE
import * as Ble from "@/lib/Ble";
import { Buffer } from "buffer";
import { State as BleState, Device } from "react-native-ble-plx";

/**
 * ✅ Adphone BLE UUIDs (自作)
 * - Raspberry Pi の GATT Server 側と必ず一致させる
 */
const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const WRITE_CHAR_UUID = "abcd1234-5678-1234-5678-abcdef123456";
/** Pi→Android 受信用（Notify） */
const NOTIFY_CHAR_UUID = "abcd1234-5678-1234-5678-abcdef123457";

const ADPHONE_DISPLAY_NAME = "ADPHONE";

/**
 * 広告に SERVICE_UUID を含む、または名前が ADPHONE なら ADPHONE とみなす
 */
function isAdphoneDevice(device: Device): boolean {
  const name = (device.name ?? "").trim().toUpperCase();
  const local = (device.localName ?? "").trim().toUpperCase();
  if (name === ADPHONE_DISPLAY_NAME || local === ADPHONE_DISPLAY_NAME) return true;
  const uuids = device.serviceUUIDs ?? [];
  const want = SERVICE_UUID.toLowerCase();
  return uuids.some((u) => (u ?? "").toLowerCase() === want);
}

/**
 * 一覧用表示名（ADPHONE 判定なら "ADPHONE" を返す）
 */
function getDeviceDisplayName(device: Device): string {
  if (isAdphoneDevice(device)) return ADPHONE_DISPLAY_NAME;
  return device.name ?? device.localName ?? "(no name)";
}

/**
 * 文字列⇄Base64（BLE write でよく使う）
 */
function toBase64(str: string) {
  return Buffer.from(str, "utf8").toString("base64");
}
function fromBase64(b64: string) {
  return Buffer.from(b64, "base64").toString("utf8");
}

export default function AdphoneSettingsScreen() {
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bleState, setBleState] = useState<BleState | "unknown">("unknown");
  const [status, setStatus] = useState<string>("ready");

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [query, setQuery] = useState("");

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connected, setConnected] = useState<Device | null>(null);

  // 送信テスト
  const [outgoing, setOutgoing] = useState("hello adphone");
  // Pi→アプリ受信ログ（Notify）
  const [receivedLog, setReceivedLog] = useState<string[]>([]);

  // アプリ全体で1つの BLE を使い、画面を離れても接続を維持する
  useEffect(() => {
    const mgr = Ble.getBleManager();
    const stateSub = mgr.onStateChange((s) => setBleState(s), true);
    const unsubConnection = Ble.subscribeConnectionChange((device) => {
      setConnected(device);
      if (device) {
        Ble.startNotifyText({
          serviceUuid: SERVICE_UUID,
          charUuid: NOTIFY_CHAR_UUID,
          onText: (text) =>
            setReceivedLog((prev) => [text, ...prev].slice(0, 50)),
          onError: (msg) => setStatus(`notify error: ${msg}`),
        }).catch(() => {});
      } else {
        setStatus("disconnected");
      }
    });

    return () => {
      stateSub.remove();
      unsubConnection();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      try {
        mgr.stopDeviceScan();
      } catch {}
      Ble.stopNotify();
      // 切断はしない（切断ボタンのときだけ Ble.disconnect を呼ぶ）
    };
  }, []);

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      const name = (d.name ?? "").toLowerCase();
      const local = (d.localName ?? "").toLowerCase();
      const id = (d.id ?? "").toLowerCase();
      const displayName = getDeviceDisplayName(d).toLowerCase();
      return name.includes(q) || local.includes(q) || id.includes(q) || displayName.includes(q);
    });
  }, [devices, query]);

  const ensureManager = () => Ble.getBleManager();

  const stopScan = () => {
    try {
      Ble.getBleManager().stopDeviceScan();
    } catch {}
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setScanning(false);
    setStatus("scan stopped");
  };

  const startScan = async () => {
    try {
      const mgr = ensureManager();

      const permOk = await Ble.ensureBlePermissions();
      if (!permOk) {
        Alert.alert(
          "権限が必要です",
          "Bluetooth（スキャン/接続）権限を許可してください。"
        );
        return;
      }

      if (bleState !== "PoweredOn") {
        Alert.alert(
          "Bluetoothがオフです",
          "端末のBluetoothをオンにしてから再度お試しください。"
        );
        return;
      }

      // reset
      stopScan();
      setDevices([]);
      setStatus("scanning...");
      setScanning(true);

      const seen = new Set<string>();

      // アドフォンデバイスのみ表示（名前が ADPHONE または広告に SERVICE_UUID を含むもの）
      mgr.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          setStatus(`scan error: ${error.message}`);
          setScanning(false);
          return;
        }
        if (!device) return;

        if (!seen.has(device.id) && isAdphoneDevice(device)) {
          seen.add(device.id);
          setDevices((prev) => [device, ...prev]);
        }
      });

      // 10秒で自動停止（連打でも多重にならないように ref 管理）
      scanTimeoutRef.current = setTimeout(() => stopScan(), 10_000);
    } catch (e: any) {
      setStatus(`scan failed: ${String(e?.message ?? e)}`);
      setScanning(false);
    }
  };

  const connect = async (device: Device) => {
    try {
      stopScan();
      setConnectingId(device.id);
      setStatus(`connecting: ${getDeviceDisplayName(device)}`);

      await Ble.connect(device.id);
      setStatus("connected");
      setReceivedLog([]);
    } catch (e: any) {
      console.log("Ble.connect error:", JSON.stringify(e));
      setStatus(`connect failed: ${String(e?.message ?? e)}`);
    } finally {
      setConnectingId(null);
    }
  };

  const disconnect = async () => {
    try {
      if (!connected) return;
      setStatus("disconnecting...");
      await Ble.disconnect();
      setConnected(null);
    } catch (e: any) {
      setStatus(`disconnect failed: ${String(e?.message ?? e)}`);
    }
  };

  const sendTestMessage = async () => {
    try {
      if (!connected) {
        Alert.alert("未接続", "先にデバイスへ接続してください。");
        return;
      }
      await Ble.writeText({
        serviceUuid: SERVICE_UUID,
        charUuid: WRITE_CHAR_UUID,
        text: outgoing,
      });
      setStatus("sent");
    } catch (e: any) {
      setStatus(`send failed: ${String(e?.message ?? e)}`);
      Alert.alert("送信失敗", String(e?.message ?? e));
    }
  };

  return (
    <ScreenLayout title="設定" subtitle="アドフォン連携（Bluetooth）">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* 状態 */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Bluetooth状態</Text>
            <Text style={styles.value}>
              {bleState === "PoweredOn" ? "ON" : String(bleState)}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>接続</Text>
            <Text style={styles.value}>
              {connected
                ? getDeviceDisplayName(connected)
                : "未接続"}
            </Text>
          </View>

          <Text style={styles.statusText}>status: {status}</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            {!scanning ? (
              <Pressable
                onPress={startScan}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.primaryBtnText}>周辺をスキャン</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={stopScan}
                style={({ pressed }) => [
                  styles.grayBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.grayBtnText}>停止</Text>
              </Pressable>
            )}

            {connected ? (
              <Pressable
                onPress={disconnect}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.dangerBtnText}>切断</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </View>

        {/* フィルタ */}
        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="名前 / ID で絞り込み…"
            placeholderTextColor={Design.colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        {/* デバイス一覧 */}
        <View style={styles.listWrap}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>見つかったアドフォン</Text>
            {scanning && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={{ color: Design.colors.textMuted, fontSize: Design.fontSize.caption }}>scanning…</Text>
              </View>
            )}
          </View>

          {filteredDevices.length === 0 ? (
            <Text style={styles.listEmptyText}>
              まだアドフォンは見つかっていません。周辺をスキャンしてください。
            </Text>
          ) : (
            filteredDevices.map((item) => {
              const name = getDeviceDisplayName(item);
              const isConnecting = connectingId === item.id;
              const isConnected = connected?.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => connect(item)}
                  disabled={isConnecting || isConnected}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    pressed && !isConnecting && !isConnected && { opacity: 0.9 },
                    isConnected && styles.deviceRowConnected,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.deviceId} numberOfLines={1}>
                      {item.id}
                    </Text>
                  </View>
                  <View style={styles.deviceRight}>
                    {isConnected ? (
                      <Text
                        style={[
                          styles.badge,
                          { backgroundColor: Design.colors.successMuted, color: Design.colors.success },
                        ]}
                      >
                        connected
                      </Text>
                    ) : isConnecting ? (
                      <Text
                        style={[
                          styles.badge,
                          { backgroundColor: Design.colors.surface, color: Design.colors.text },
                        ]}
                      >
                        connecting…
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.badge,
                          { backgroundColor: Design.colors.primaryMuted, color: Design.colors.primary },
                        ]}
                      >
                        connect
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* 送信テスト */}
        <View style={styles.card}>
          <Text style={styles.listTitle}>接続テスト（送信・受信）</Text>
          <Text style={styles.sectionPurpose}>
            接続したアドフォン（ラズパイ）と BLE で文字列を送受信できるか確認するための欄です。送信するとラズパイ側で受信され、ラズパイから送ると下の受信ログに表示されます。
          </Text>
          <Text style={styles.hint}>
            Service: {SERVICE_UUID}
            {"\n"}
            Write Char: {WRITE_CHAR_UUID}
            {"\n"}
            Notify Char (Pi→App): {NOTIFY_CHAR_UUID}
          </Text>

          <TextInput
            value={outgoing}
            onChangeText={setOutgoing}
            placeholder="送信したい文字列"
            placeholderTextColor={Design.colors.textMuted}
            style={styles.messageInput}
          />

          <Pressable
            onPress={sendTestMessage}
            style={({ pressed }) => [
              styles.primaryBtn,
              !connected && { opacity: 0.5 },
              pressed && { opacity: 0.9 },
            ]}
            disabled={!connected}
          >
            <Text style={styles.primaryBtnText}>送信</Text>
          </Pressable>

          {receivedLog.length > 0 && (
            <View style={styles.receivedBox}>
              <Text style={styles.listTitle}>受信ログ（Pi→アプリ）</Text>
              {receivedLog.slice(0, 10).map((line, i) => (
                <Text key={i} style={styles.receivedLine} numberOfLines={2}>
                  {line}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.hint}>
            ※ ラズパイ側GATTの Service/Characteristic UUID と一致している必要があります。
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: Design.spacing.md,
    paddingBottom: Design.spacing.xl,
  },
  container: {
    flex: 1,
    gap: Design.spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.lg,
    padding: Design.spacing.lg,
    backgroundColor: Design.colors.background,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Design.spacing.sm,
  },
  label: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    fontWeight: Design.fontWeight.bold,
  },
  value: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.text,
    fontWeight: Design.fontWeight.bold,
  },
  statusText: {
    marginTop: Design.spacing.sm,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  grayBtn: {
    flex: 1,
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  grayBtnText: {
    color: Design.colors.text,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  dangerBtn: {
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.lg,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.bold,
    fontSize: Design.fontSize.body,
  },
  searchBox: { marginTop: Design.spacing.xs },
  searchInput: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  listWrap: {
    minHeight: 280,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.lg,
    overflow: "hidden",
  },
  listHeader: {
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    backgroundColor: Design.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listEmptyText: {
    color: Design.colors.textMuted,
    padding: Design.spacing.lg,
    fontSize: Design.fontSize.body,
  },
  listTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  sectionPurpose: {
    marginTop: Design.spacing.sm,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    lineHeight: 20,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.borderLight,
    backgroundColor: Design.colors.background,
  },
  deviceRowConnected: {
    backgroundColor: Design.colors.successMuted,
  },
  deviceName: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  deviceId: {
    marginTop: Design.spacing.xs,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  deviceRight: { marginLeft: Design.spacing.md },
  badge: {
    overflow: "hidden",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.sm,
    borderRadius: Design.radius.full,
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
  messageInput: {
    marginTop: Design.spacing.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
    marginBottom: Design.spacing.md,
  },
  hint: {
    marginTop: Design.spacing.md,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
  },
  receivedBox: {
    marginTop: Design.spacing.md,
    paddingTop: Design.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Design.colors.border,
  },
  receivedLine: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.text,
    marginBottom: Design.spacing.xs,
  },
});
