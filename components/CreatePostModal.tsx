import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertTriangle,
  Building2,
  Camera,
  Droplets,
  Flame,
  HelpCircle,
  MapPin,
  Mountain,
  X,
} from "lucide-react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Design } from "@/constants/Design";
import { LEVEL_CONFIG, type DamageLevel } from "@/constants/BuildingDamage";
import { encodePayload, payloadToNotificationItem } from "@/lib/postPayload";
import { computeFeedTrustForPostPayload } from "@/lib/trustFeedSync";
import { useBleContext } from "@/contexts/BleContext";
import { useNotifications } from "@/contexts/NotificationContext";
import type { DisasterType } from "@/contexts/NotificationContext";
import { useDisasterReport } from "@/contexts/DisasterReportContext";
import GemmaModule from "@/lib/gemma";

const GEMMA_MODEL_PATH = "/sdcard/gemma-3n-E4B-it-int4.litertlm";

const DISASTER_OPTIONS: { type: DisasterType; label: string; Icon: any; color: string }[] = [
  { type: "earthquake", label: "地震",     Icon: AlertTriangle, color: Design.colors.disasterEarthquake },
  { type: "flood",      label: "浸水",     Icon: Droplets,      color: Design.colors.disasterFlood },
  { type: "fire",       label: "火災",     Icon: Flame,         color: Design.colors.disasterFire },
  { type: "collapse",   label: "建物崩壊", Icon: Building2,     color: Design.colors.disasterCollapse },
  { type: "landslide",  label: "土砂崩れ", Icon: Mountain,      color: Design.colors.disasterLandslide },
  { type: "other",      label: "その他",   Icon: HelpCircle,    color: Design.colors.disasterOther },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CreatePostModal({ visible, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<DisasterType | null>(null);
  const [location, setLocation] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // カメラ
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [damageLevel, setDamageLevel] = useState<DamageLevel>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

  // BLE
  const { sendText, bleState } = useBleContext();
  // フィード
  const { addItem } = useNotifications();
  // マップ反映
  const { submitReport } = useDisasterReport();

  const canSubmit = selectedType && (location.trim() || gpsCoords) && content.trim();

  // モーダルが開いたときにGPS取得・フォームリセット
  useEffect(() => {
    if (!visible) return;
    setPhotoUri(null);
    setDamageLevel(null);
    setGpsCoords(null);
    setShowCamera(false);
    fetchGps();
  }, [visible]);

  const fetchGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setGpsCoords(coords);
        setLocation((prev) =>
          prev.trim() ? prev : `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
        );
      }
    } catch {
      // GPS失敗は非致命的
    } finally {
      setGpsLoading(false);
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    if (!photo) return;
    setPhotoUri(photo.uri);
    setShowCamera(false);
    setAnalyzing(true);
    try {
      // モデルが未初期化の場合（起動時の初期化に失敗していた場合など）ここで再試行
      await GemmaModule.initializeModel(GEMMA_MODEL_PATH);

      const prompt = "この画像に映っている建物の被害状況を分析してください。回答は以下の形式で始めてください：\n【被害レベル】Lv1, Lv2, Lv3のいずれか\n【状況説明】簡潔な説明";
      const result = await GemmaModule.generateResponseWithImage(prompt, photo.uri);
      console.log("[Gemma] Analysis Result:", result);

      // 被害レベルの抽出 (Lv1, Lv2, Lv3)
      if (result.includes("Lv3")) {
        setDamageLevel("Lv3");
      } else if (result.includes("Lv2")) {
        setDamageLevel("Lv2");
      } else if (result.includes("Lv1")) {
        setDamageLevel("Lv1");
      } else {
        setDamageLevel("manual");
      }

      // 状況説明の抽出とセット
      const descMatch = result.match(/【状況説明】(.*)/s);
      if (descMatch && descMatch[1]) {
        setContent(descMatch[1].trim());
      } else if (result.length > 5) {
        // 形式が違っても、ある程度長さがあればそのままセット
        setContent(result.replace(/【被害レベル】Lv[1-3]/, "").trim());
      }
    } catch (e) {
      console.error("[Gemma] Analysis failed:", e);
      setDamageLevel("manual");
    } finally {
      setAnalyzing(false);
    }
  };


  const resetPhoto = () => {
    setPhotoUri(null);
    setDamageLevel(null);
    setShowCamera(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const postPayload = {
        disasterType: selectedType!,
        damageLevel,
        lat: gpsCoords?.lat ?? null,
        lon: gpsCoords?.lon ?? null,
        text: content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
      };

      // マップ（TrustMapEngine）へ先に反映 → クラスタスコアとフィード信頼度を一致させる
      submitReport({
        disasterType: postPayload.disasterType,
        damageLevel:  postPayload.damageLevel,
        lat:          postPayload.lat,
        lon:          postPayload.lon,
        text:         postPayload.text,
        timestamp:    postPayload.timestamp,
      });

      const { trustLevel, trustScore } = computeFeedTrustForPostPayload(postPayload);
      const localItem = payloadToNotificationItem(postPayload, {
        author: "あなた",
        trustLevel,
        trustScore,
      });
      addItem(localItem);

      // BLE送信（オフライン対応・プライマリパス）
      if (bleState === "connected") {
        await sendText(encodePayload(postPayload));
      }

      // TODO: Firebase保存（セカンダリパス）
    } catch (e) {
      console.error("[Post] submit error", e);
    } finally {
      setSubmitting(false);
      setSelectedType(null);
      setLocation("");
      setContent("");
      setPhotoUri(null);
      setDamageLevel(null);
      setGpsCoords(null);
      onClose();
    }
  };

  return (
    <>
    {/* フルスクリーンカメラ */}
    <Modal
      visible={showCamera}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setShowCamera(false)}
    >
      <View style={styles.fullCameraRoot}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />
        {/* 閉じるボタン */}
        <TouchableOpacity style={styles.fullCameraClose} onPress={() => setShowCamera(false)}>
          <X size={22} color={Design.colors.white} />
        </TouchableOpacity>
        {/* 撮影ガイドラム */}
        <View style={styles.fullCameraGuide}>
          <Text style={styles.fullCameraGuideText}>建物全体が収まるように撮影してください</Text>
        </View>
        {/* シャッターボタン */}
        <TouchableOpacity style={styles.fullCameraCapture} onPress={takePhoto} activeOpacity={0.8}>
          <View style={styles.fullCameraCaptureDot} />
        </TouchableOpacity>
      </View>
    </Modal>

    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ヘッダー */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>災害情報を投稿</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={Design.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* 災害種別 */}
          <Text style={styles.fieldLabel}>災害種別 <Text style={styles.required}>*</Text></Text>
          <View style={styles.typeGrid}>
            {DISASTER_OPTIONS.map(({ type, label, Icon, color }) => {
              const active = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, active && { borderColor: color, backgroundColor: color + "18" }]}
                  onPress={() => setSelectedType(active ? null : type)}
                  activeOpacity={0.7}
                >
                  <Icon size={18} color={active ? color : Design.colors.textMuted} strokeWidth={2} />
                  <Text style={[styles.typeBtnLabel, active && { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 場所 */}
          <Text style={styles.fieldLabel}>場所</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={location}
              onChangeText={setLocation}
              placeholder="例: 渋谷区道玄坂"
              placeholderTextColor={Design.colors.textMuted}
            />
            <TouchableOpacity style={styles.locationBtn} activeOpacity={0.7} onPress={fetchGps}>
              {gpsLoading ? (
                <ActivityIndicator size="small" color={Design.colors.primary} />
              ) : (
                <MapPin size={18} color={Design.colors.primary} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
          {gpsCoords && (
            <View style={styles.gpsChip}>
              <Text style={styles.gpsChipText}>
                📍 {gpsCoords.lat.toFixed(4)}, {gpsCoords.lon.toFixed(4)}　[GPS自動取得]
              </Text>
            </View>
          )}

          {/* 写真・崩壊度判定 */}
          <Text style={styles.fieldLabel}>写真（任意）</Text>
          {!photoUri && (
            <TouchableOpacity style={styles.cameraBtn} onPress={openCamera} activeOpacity={0.7}>
              <Camera size={18} color={Design.colors.primary} strokeWidth={2} />
              <Text style={styles.cameraBtnText}>建物を撮影して崩壊度を判定</Text>
            </TouchableOpacity>
          )}
          {photoUri && (
            <View style={styles.photoResult}>
              <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
              <View style={styles.damageInfo}>
                {analyzing ? (
                  <ActivityIndicator size="small" color={Design.colors.primary} />
                ) : damageLevel === "manual" ? (
                  // AI判定不可 → 手動選択
                  <>
                    <Text style={styles.manualLabel}>損傷レベルを選択</Text>
                    <View style={styles.manualBtns}>
                      {(["Lv1", "Lv2", "Lv3"] as const).map((lv) => (
                        <TouchableOpacity
                          key={lv}
                          style={[styles.manualBtn, { borderColor: LEVEL_CONFIG[lv].color }]}
                          onPress={() => setDamageLevel(lv)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.manualBtnText, { color: LEVEL_CONFIG[lv].color }]}>
                            {lv}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : damageLevel ? (
                  <View style={[styles.damageBadge, {
                    backgroundColor: LEVEL_CONFIG[damageLevel].bg,
                    borderColor: LEVEL_CONFIG[damageLevel].color,
                  }]}>
                    <Text style={[styles.damageBadgeText, { color: LEVEL_CONFIG[damageLevel].color }]}>
                      {damageLevel}　{LEVEL_CONFIG[damageLevel].label}
                    </Text>
                    <TouchableOpacity onPress={() => setDamageLevel("manual")}>
                      <Text style={styles.changeText}>変更</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <TouchableOpacity onPress={resetPhoto}>
                  <Text style={styles.retryText}>再撮影</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 内容 */}
          <Text style={styles.fieldLabel}>内容 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={content}
            onChangeText={setContent}
            placeholder="現在の状況を詳しく記載してください..."
            placeholderTextColor={Design.colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.helper}>具体的な状況・被害状況・必要な支援などを記載してください</Text>

          {/* 注意書き */}
          <View style={styles.warningBox}>
            <AlertTriangle size={14} color={Design.colors.warning} strokeWidth={2} />
            <View style={styles.warningBody}>
              <Text style={styles.warningTitle}>投稿時の注意</Text>
              <Text style={styles.warningText}>・虚偽情報の投稿は厳禁です{"\n"}・個人情報は記載しないでください{"\n"}・公式情報と異なる場合があります</Text>
            </View>
          </View>

          {/* BLE未接続警告 */}
          {bleState !== "connected" && (
            <Text style={styles.bleWarning}>⚠️ BLE未接続 — LPWAブロードキャストは行われません</Text>
          )}

          {/* 送信ボタン */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>
              {submitting ? "投稿中..." : "投稿する"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Design.colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Design.colors.border,
  },
  modalTitle: { fontSize: Design.fontSize.subtitle, fontWeight: Design.fontWeight.bold, color: Design.colors.text },
  body: { padding: Design.spacing.lg },
  fieldLabel: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
    marginBottom: Design.spacing.sm,
    marginTop: Design.spacing.md,
  },
  required: { color: Design.colors.danger },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Design.spacing.sm },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: Design.spacing.sm,
    borderRadius: Design.radius.full,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.surface,
  },
  typeBtnLabel: { fontSize: Design.fontSize.caption, color: Design.colors.textMuted, fontWeight: Design.fontWeight.semi },
  locationRow: { flexDirection: "row", gap: Design.spacing.sm, alignItems: "center" },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    backgroundColor: Design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsChip: {
    marginTop: Design.spacing.xs,
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: 6,
    backgroundColor: Design.colors.primaryMuted,
    borderRadius: Design.radius.sm,
    alignSelf: "flex-start",
  },
  gpsChipText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.primary,
  },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    padding: Design.spacing.md,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderStyle: "dashed",
    backgroundColor: Design.colors.surface,
  },
  cameraBtnText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.primary,
    fontWeight: Design.fontWeight.semi,
  },
  // フルスクリーンカメラ
  fullCameraRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullCameraClose: {
    position: "absolute",
    top: 52,
    right: Design.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullCameraGuide: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fullCameraGuideText: {
    fontSize: Design.fontSize.caption,
    color: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 6,
    borderRadius: Design.radius.full,
    overflow: "hidden",
  },
  fullCameraCapture: {
    position: "absolute",
    bottom: 56,
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3,
    borderColor: Design.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  fullCameraCaptureDot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Design.colors.white,
  },
  photoResult: {
    flexDirection: "row",
    gap: Design.spacing.md,
    alignItems: "flex-start",
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: Design.radius.md,
    backgroundColor: Design.colors.surfaceElevated,
  },
  damageInfo: {
    flex: 1,
    gap: Design.spacing.sm,
    justifyContent: "center",
  },
  damageBadge: {
    paddingHorizontal: Design.spacing.sm,
    paddingVertical: Design.spacing.xs,
    borderRadius: Design.radius.md,
    borderWidth: 2,
    alignSelf: "flex-start",
  },
  damageBadgeText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
  },
  manualLabel: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textSecondary,
    marginBottom: 6,
  },
  manualBtns: {
    flexDirection: "row",
    gap: 6,
  },
  manualBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Design.radius.md,
    borderWidth: 2,
    backgroundColor: Design.colors.surface,
  },
  manualBtnText: {
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.bold,
  },
  changeText: {
    fontSize: 11,
    color: Design.colors.textMuted,
    marginTop: 2,
  },
  retryText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.primary,
    fontWeight: Design.fontWeight.semi,
  },
  input: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    backgroundColor: Design.colors.background,
  },
  textarea: { height: 120 },
  helper: { fontSize: 12, color: Design.colors.textMuted, marginTop: 4, marginBottom: Design.spacing.md },
  warningBox: {
    flexDirection: "row",
    gap: Design.spacing.sm,
    backgroundColor: Design.colors.warningMuted,
    borderWidth: 1,
    borderColor: Design.colors.warning + "40",
    borderRadius: Design.radius.md,
    padding: Design.spacing.md,
    marginBottom: Design.spacing.md,
  },
  warningBody: { flex: 1 },
  warningTitle: { fontSize: Design.fontSize.caption, fontWeight: Design.fontWeight.bold, color: "#92400e", marginBottom: 4 },
  warningText: { fontSize: 12, color: "#92400e", lineHeight: 18 },
  bleWarning: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.warning,
    textAlign: "center",
    marginBottom: Design.spacing.sm,
  },
  submitBtn: {
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.lg,
    paddingVertical: Design.spacing.lg,
    alignItems: "center",
    marginBottom: Design.spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: Design.colors.white, fontSize: Design.fontSize.body, fontWeight: Design.fontWeight.bold },
});
