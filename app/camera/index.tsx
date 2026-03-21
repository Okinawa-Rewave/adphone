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
import { BrowserHeader } from "@/components/BrowserHeader";
import { AppHeader } from "@/components/AppHeader";
import { MobileFrame } from "@/components/MobileFrame";

const { PeopleDetector } = NativeModules;

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
  // ここは「表示領域上のピクセル座標」で持つ（描画が簡単）
  bboxPx: { x: number; y: number; w: number; h: number };
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MODEL_SIZE = 640;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [state, setState] = useState<CameraState>("preview");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);

  // Image表示領域（containで黒帯が出るので、ここが超重要）
  const [imageBox, setImageBox] = useState<{ w: number; h: number }>({
    w: SCREEN_WIDTH,
    h: SCREEN_WIDTH, // 初期値
  });

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageBox({ w: width, h: height });
  };

  // 640->表示領域への変換（contain想定）
  const projector = useMemo(() => {
    const scale = Math.min(imageBox.w / MODEL_SIZE, imageBox.h / MODEL_SIZE);
    const drawW = MODEL_SIZE * scale;
    const drawH = MODEL_SIZE * scale;
    const offsetX = (imageBox.w - drawW) / 2;
    const offsetY = (imageBox.h - drawH) / 2;
    return { scale, offsetX, offsetY };
  }, [imageBox]);

  const analyzeWithModel = async (uri: string): Promise<Detection[]> => {
    console.log("JS: calling PeopleDetector.detectFromUri", uri);

    const raw: NativeDet[] = await PeopleDetector.detectFromUri(uri);
    console.log("JS: detectFromUri returned", raw);

    // Nativeの{x1,y1,x2,y2,score} (0..640基準) を、
    // 画面表示上のピクセル座標に投影して Detection に変換
    const { scale, offsetX, offsetY } = projector;

    return raw.map((d, idx) => {
      const x = d.x1 * scale + offsetX;
      const y = d.y1 * scale + offsetY;
      const w = (d.x2 - d.x1) * scale;
      const h = (d.y2 - d.y1) * scale;

      return {
        id: idx,
        score: d.score,
        bboxPx: { x, y, w, h },
      };
    });
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync();
    if (!photo) return;

    setPhotoUri(photo.uri);
    setState("captured");

    try {
      const result = await analyzeWithModel(photo.uri);
      setDetections(result);
      setState("analyzed");
    } catch (e) {
      console.log("JS: detectFromUri ERROR", e);
      setDetections([]);
      setState("analyzed");
    }
  };

  const peopleCount = detections.length;

  if (!permission?.granted) {
    return (
      <MobileFrame>
        <BrowserHeader />
        <AppHeader title="カメラ" subtitle="権限を許可してください" />
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>カメラの権限を許可してください</Text>
        </View>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <BrowserHeader />
      <AppHeader title="カメラ" subtitle="人数検出" />
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

            {/* bbox描画（imageWrapの座標系で描く） */}
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
          </View>

          {/* 解析結果 */}
          <View style={styles.result}>
            <Text style={styles.resultText}>👤 人数：{peopleCount} 人</Text>
            <Pressable
              onPress={() => {
                setDetections([]);
                setPhotoUri(null);
                setState("preview");
              }}
            >
              <Text style={styles.retry}>再撮影</Text>
            </Pressable>
          </View>
        </View>
      )}
      </View>
    </MobileFrame>
  );
}

const styles = StyleSheet.create({
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
    height: "70%",
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
});
