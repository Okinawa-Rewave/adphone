// components/InteractiveMap.tsx
import React, { useMemo } from "react";
import { View, Image, StyleSheet, Dimensions, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

// Props：現在地だけ
export type InteractiveMapProps = {
  latitude: number;
  longitude: number;
};

// 画像サイズと緯度経度の対応
const IMG_WIDTH = 1498;
const IMG_HEIGHT = 1608;
const TOP_LEFT = { lat: 26.5296710, lon: 128.0261810 };
const BOTTOM_RIGHT = { lat: 26.5221540, lon: 128.0336490 };

// 画面幅に合わせた初期スケール
const { width: GLOBAL_SCREEN_WIDTH } = Dimensions.get("window");
const GLOBAL_INITIAL_SCALE = GLOBAL_SCREEN_WIDTH / IMG_WIDTH;
const MAX_SCALE = 3;

// 緯度経度 → ピクセル座標
function latLonToPixel(lat: number, lon: number) {
  const x =
    ((lon - TOP_LEFT.lon) / (BOTTOM_RIGHT.lon - TOP_LEFT.lon)) * IMG_WIDTH;
  const y =
    ((TOP_LEFT.lat - lat) / (TOP_LEFT.lat - BOTTOM_RIGHT.lat)) * IMG_HEIGHT;
  return { x, y };
}

// プレイヤーマーカーだけ残す
const PlayerMarker = ({
  x,
  y,
  scale,
}: {
  x: number;
  y: number;
  scale: SharedValue<number>;
}) => {
  const markerAnimatedStyle = useAnimatedStyle(() => {
    const inverseScale = 1 / scale.value;
    return {
      transform: [{ scale: inverseScale }],
      left: x - styles.marker.width / 2,
      top: y - styles.marker.height / 2,
    };
  }, [x, y]);

  return (
    <Animated.View style={[styles.marker, styles.playerMarker, markerAnimatedStyle]}>
      <Text style={styles.markerText}>👤</Text>
    </Animated.View>
  );
};

export function InteractiveMap({ latitude, longitude }: InteractiveMapProps) {
  const scale = useSharedValue(GLOBAL_INITIAL_SCALE);
  const savedScale = useSharedValue(GLOBAL_INITIAL_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const screenDimensions = useMemo(() => Dimensions.get("window"), []);
  const SCREEN_WIDTH = screenDimensions.width;
  const SCREEN_HEIGHT = screenDimensions.height;

  const playerPoint = latLonToPixel(latitude, longitude);

  // ピンチ
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      "worklet";
      scale.value = Math.min(
        Math.max(savedScale.value * event.scale, GLOBAL_INITIAL_SCALE),
        MAX_SCALE
      );
    });

  // パン
  const panGesture = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      "worklet";
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      "worklet";
      const scaledWidth = scale.value * IMG_WIDTH;
      const scaledHeight = scale.value * IMG_HEIGHT;

      const maxScrollX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
      const maxScrollY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);

      let newX = savedTranslateX.value + event.translationX;
      let newY = savedTranslateY.value + event.translationY;

      translateX.value = Math.min(Math.max(newX, -maxScrollX), maxScrollX);
      translateY.value = Math.min(Math.max(newY, -maxScrollY), maxScrollY);
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  return (
    <View style={styles.outerContainer}>
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.mapContainer, animatedStyle]}>
          {/* OSMから切り出したPNG */}
          <Image
            source={require("@/assets/map.png")} // 実際のパスに合わせて調整
            style={styles.mapImage}
          />

          {/* プレイヤーの現在地マーカー */}
          <PlayerMarker x={playerPoint.x} y={playerPoint.y} scale={scale} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#000",
  },
  mapContainer: {
    width: IMG_WIDTH,
    height: IMG_HEIGHT,
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  marker: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  playerMarker: {
    backgroundColor: "red",
  },
  markerText: {
    fontSize: 18,
    color: "white",
  },
});
