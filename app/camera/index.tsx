// app/camera/index.tsx
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Design } from "@/constants/Design";
import { LEVEL_CONFIG } from "@/constants/BuildingDamage";
import { ScreenLayout } from "@/components/ScreenLayout";

const { PeopleDetector, BuildingDamage } = NativeModules;

type CameraMode = "people" | "building";
type CameraState = "preview" | "captured" | "analyzed";

type NativeDet = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
};

type Detection = {
  id: number;
  score: number;
  bboxPx: { x: number; y: number; w: number; h: number };
};

type BuildingResult = {
  level: "Lv1" | "Lv2" | "Lv3";
  scores: number[];
};

const CLASS_NAMES: BuildingResult["level"][] = ["Lv1", "Lv2", "Lv3"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODEL_SIZE = 640;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [mode, setMode] = useState<CameraMode>("people");
  const [state, setState] = useState<CameraState>("preview");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [buildingResult, setBuildingResult] = useState<BuildingResult | null>(null);

  const [imageBox, setImageBox] = useState<{ w: number; h: number }>({
    w: SCREEN_WIDTH,
    h: SCREEN_WIDTH,
  });

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageBox({ w: width, h: height });
  };

  const projector = useMemo(() => {
    const scale = Math.min(imageBox.w / MODEL_SIZE, imageBox.h / MODEL_SIZE);
    const drawW = MODEL_SIZE * scale;
    const drawH = MODEL_SIZE * scale;
    const offsetX = (imageBox.w - drawW) / 2;
    const offsetY = (imageBox.h - drawH) / 2;
    return { scale, offsetX, offsetY };
  }, [imageBox]);

  const switchMode = (next: CameraMode) => {
    setMode(next);
    setDetections([]);
    setBuildingResult(null);
    setPhotoUri(null);
    setState("preview");
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    if (!photo) return;

    setPhotoUri(photo.uri);
    setState("captured");

    try {
      if (mode === "people") {
        const raw: NativeDet[] = await PeopleDetector.detectFromUri(photo.uri);
        const { scale, offsetX, offsetY } = projector;
        const result = raw.map((d, idx) => ({
          id: idx,
          score: d.score,
          bboxPx: {
            x: d.x1 * scale + offsetX,
            y: d.y1 * scale + offsetY,
            w: (d.x2 - d.x1) * scale,
            h: (d.y2 - d.y1) * scale,
          },
        }));
        setDetections(result);
      } else {
        const result: BuildingResult = await BuildingDamage.classifyFromUri(photo.uri);
        setBuildingResult(result);
      }
      setState("analyzed");
    } catch (e) {
      console.log("Camera analysis error:", e);
      setState("analyzed");
    }
  };

  const reset = () => {
    setDetections([]);
    setBuildingResult(null);
    setPhotoUri(null);
    setState("preview");
  };

  if (!permission?.granted) {
    return (
      <ScreenLayout title="カメラ" subtitle="権限を許可してください" contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>カメラの権限を許可してください</Text>
        </View>
      </ScreenLayout>
    );
  }

  const subtitle = mode === "people" ? "人数検出" : "建物崩壊判定";

  return (
    <ScreenLayout title="カメラ" subtitle={subtitle} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      {/* モード切替タブ */}
      <View style={styles.modeTab}>
        <Pressable
          style={[styles.modeBtn, mode === "people" && styles.modeBtnActive]}
          onPress={() => switchMode("people")}
        >
          <Text style={[styles.modeBtnText, mode === "people" && styles.modeBtnTextActive]}>
            👤 人数カウント
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "building" && styles.modeBtnActive]}
          onPress={() => switchMode("building")}
        >
          <Text style={[styles.modeBtnText, mode === "building" && styles.modeBtnTextActive]}>
            🏚️ 崩壊判定
          </Text>
        </Pressable>
      </View>

      <View style={styles.cameraContainer}>
        {/* 撮影前 */}
        {state === "preview" && (
          <>
            <CameraView ref={cameraRef} style={{ flex: 1 }} />
            <Pressable style={styles.captureButton} onPress={takePhoto} />
          </>
        )}

        {/* 撮影後 + 解析 */}
        {state !== "preview" && photoUri && (
          <View style={{ flex: 1 }}>
            <View style={styles.imageWrap} onLayout={onImageLayout}>
              <Image source={{ uri: photoUri }} style={styles.image} resizeMode="contain" />

              {/* 人数モード: バウンディングボックス */}
              {mode === "people" && (
                <Svg style={StyleSheet.absoluteFill}>
                  {detections.map((det) => (
                    <Rect
                      key={det.id}
                      x={det.bboxPx.x}
                      y={det.bboxPx.y}
                      width={det.bboxPx.w}
                      height={det.bboxPx.h}
                      stroke="red"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  ))}
                </Svg>
              )}
            </View>

            {/* 解析結果 */}
            <View style={styles.result}>
              {mode === "people" && (
                <>
                  <Text style={styles.resultText}>👤 人数：{detections.length} 人</Text>
                  <Pressable onPress={reset}>
                    <Text style={styles.retry}>再撮影</Text>
                  </Pressable>
                </>
              )}

              {mode === "building" && buildingResult && (
                <BuildingResultCard result={buildingResult} onRetry={reset} />
              )}

              {mode === "building" && !buildingResult && state === "analyzed" && (
                <>
                  <Text style={styles.resultText}>判定に失敗しました</Text>
                  <Pressable onPress={reset}>
                    <Text style={styles.retry}>再撮影</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </ScreenLayout>
  );
}

// =====================================================
// 建物崩壊結果カード
// =====================================================
function BuildingResultCard({ result, onRetry }: { result: BuildingResult; onRetry: () => void }) {
  const cfg = LEVEL_CONFIG[result.level];

  return (
    <View style={styles.buildingCard}>
      {/* レベルバッジ */}
      <View style={[styles.levelBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
        <Text style={[styles.levelText, { color: cfg.color }]}>{result.level}</Text>
        <Text style={[styles.levelLabel, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* 各クラスの確率バー */}
      <View style={styles.scoresWrap}>
        {CLASS_NAMES.map((cls, i) => {
          const pct = Math.round((result.scores[i] ?? 0) * 100);
          const c = LEVEL_CONFIG[cls];
          return (
            <View key={cls} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{cls}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: c.color }]} />
              </View>
              <Text style={styles.scorePct}>{pct}%</Text>
            </View>
          );
        })}
      </View>

      <Pressable onPress={onRetry}>
        <Text style={styles.retry}>再撮影</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  modeTab: {
    flexDirection: "row",
    margin: Design.spacing.md,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    overflow: "hidden",
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Design.spacing.sm,
    alignItems: "center",
    backgroundColor: Design.colors.surface,
  },
  modeBtnActive: {
    backgroundColor: Design.colors.primary,
  },
  modeBtnText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textMuted,
  },
  modeBtnTextActive: {
    color: Design.colors.white,
  },
  cameraContainer: { flex: 1 },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Design.spacing.lg,
  },
  placeholderText: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textSecondary,
  },
  captureButton: {
    position: "absolute",
    bottom: Design.spacing.xxl,
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: Design.radius.lg,
    backgroundColor: Design.colors.background,
    borderWidth: 2,
    borderColor: Design.colors.border,
  },
  imageWrap: {
    width: "100%",
    height: "60%",
    backgroundColor: Design.colors.text,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  result: {
    padding: Design.spacing.lg,
    backgroundColor: Design.colors.background,
  },
  resultText: {
    fontSize: Design.fontSize.title,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  retry: {
    marginTop: Design.spacing.sm,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.primary,
  },
  buildingCard: {
    gap: Design.spacing.md,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
    padding: Design.spacing.md,
    borderRadius: Design.radius.lg,
    borderWidth: 2,
  },
  levelText: {
    fontSize: Design.fontSize.titleLarge,
    fontWeight: Design.fontWeight.bold,
  },
  levelLabel: {
    fontSize: Design.fontSize.bodyLarge,
    fontWeight: Design.fontWeight.semi,
  },
  scoresWrap: {
    gap: Design.spacing.xs,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Design.spacing.sm,
  },
  scoreLabel: {
    width: 32,
    fontSize: Design.fontSize.caption,
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.textSecondary,
  },
  barBg: {
    flex: 1,
    height: 8,
    borderRadius: Design.radius.full,
    backgroundColor: Design.colors.surfaceElevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: Design.radius.full,
  },
  scorePct: {
    width: 36,
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    textAlign: "right",
  },
});
