import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';
// ジェスチャーハンドラとアニメーションのインポート
import { Gesture, GestureDetector } from 'react-native-gesture-handler'; 
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue, // SharedValueの型をインポート
} from 'react-native-reanimated';

// 宝のデータ型定義をエクスポート
export type Treasure = { // 💡 qrCodeIdを追加
  id: string;
  lat: number;
  lon: number;
  qrCodeId: string; // 💡 QRコードでスキャンされる宝箱のID
  status: 'unfound' | 'found'; 
  point: number;
};

// Props型定義をエクスポート
export type Props = {
  latitude: number;
  longitude: number;
  treasures: Treasure[]; // 宝の座標リスト
  onTreasureFound: (id: string) => void; // 💡 宝が見つかったときのコールバックを追加
};

// 🗺️ 地図の定数 (画像サイズと緯度/経度の境界)
const IMG_WIDTH = 1498;
const IMG_HEIGHT = 1608;
const TOP_LEFT = { lat: 26.5296710, lon: 128.0261810 };
const BOTTOM_RIGHT = { lat: 26.5221540, lon: 128.0336490 };

// 💡 画面サイズをコンポーネントの外部で一度だけ取得 (JSスレッドで実行)
const { width: GLOBAL_SCREEN_WIDTH } = Dimensions.get('window');

// 画面幅に対する初期縮小率を計算
const GLOBAL_INITIAL_SCALE = GLOBAL_SCREEN_WIDTH / IMG_WIDTH;
const MAX_SCALE = 3; // 最大ズーム倍率

// 緯度/経度をピクセル座標に変換する関数
function latLonToPixel(lat: number, lon: number) {
  const x = ((lon - TOP_LEFT.lon) / (BOTTOM_RIGHT.lon - TOP_LEFT.lon)) * IMG_WIDTH;
  const y = ((TOP_LEFT.lat - lat) / (TOP_LEFT.lat - BOTTOM_RIGHT.lat)) * IMG_HEIGHT;
  return { x, y };
}

// プレイヤーマーカーコンポーネント (Hooksを内部で実行)
const PlayerMarker = ({ x, y, scale }: { x: number, y: number, scale: SharedValue<number> }) => {
  // useAnimatedStyleをコンポーネントのトップレベルで呼び出す
  const markerAnimatedStyle = useAnimatedStyle(() => {
    const inverseScale = 1 / scale.value; 
    return {
      transform: [{ scale: inverseScale }],
      left: x - styles.marker.width / 2,
      top: y - styles.marker.height / 2,
    };
  }, [x, y]); // x, yが変更されたときのみ再計算

  return (
    <Animated.View
      style={[styles.marker, styles.playerMarker, markerAnimatedStyle]}
    >
      <Text style={styles.markerText}>👤</Text>
    </Animated.View>
  );
};

// 宝マーカーコンポーネント (Hooksを内部で実行)
const TreasureMarker = ({ x, y, scale, isFound }: { x: number, y: number, scale: SharedValue<number>, isFound: boolean }) => {
  // useAnimatedStyleをコンポーネントのトップレベルで呼び出す
  const markerAnimatedStyle = useAnimatedStyle(() => {
    const inverseScale = 1 / scale.value; 
    return {
      transform: [{ scale: inverseScale }],
      left: x - styles.marker.width / 2,
      top: y - styles.marker.height / 2,
    };
  }, [x, y, isFound]); // x, y, isFoundが変更されたときのみ再計算

  return (
    <Animated.View
      style={[
        styles.marker, 
        styles.treasureMarker, 
        { backgroundColor: isFound ? 'green' : 'blue' },
        markerAnimatedStyle
      ]}
    >
      <Text style={styles.markerText}>{isFound ? '✅' : '💰'}</Text>
    </Animated.View>
  );
};

export default function InteractiveMap({ latitude, longitude, treasures, onTreasureFound }: Props) {
  // ズームとパンの状態を管理する共有値 (Shared Values)
  const scale = useSharedValue(GLOBAL_INITIAL_SCALE);
  const savedScale = useSharedValue(GLOBAL_INITIAL_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 💡 コンポーネント内で画面の幅/高さを取得 (JSスレッドで実行)
  const screenDimensions = useMemo(() => Dimensions.get('window'), []);
  const SCREEN_WIDTH = screenDimensions.width;
  const SCREEN_HEIGHT = screenDimensions.height;

  // マーカーの位置を計算
  const playerPoint = latLonToPixel(latitude, longitude);

  // --- ズームジェスチャー (PinchGesture) ---
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      'worklet'; 
      // ズーム範囲を制限
      scale.value = Math.min(
        Math.max(savedScale.value * event.scale, GLOBAL_INITIAL_SCALE), 
        MAX_SCALE
      );
    });

  // --- パンジェスチャー (PanGesture) ---
  const panGesture = Gesture.Pan()
    .minDistance(1)
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet'; 
      
      // 画面上の地図の表示サイズを取得
      const scaledWidth = scale.value * IMG_WIDTH;
      const scaledHeight = scale.value * IMG_HEIGHT;
      
      // スクロール可能な最大オフセット
      const maxScrollX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
      const maxScrollY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);

      // 移動を適用
      let newX = savedTranslateX.value + event.translationX;
      let newY = savedTranslateY.value + event.translationY;
      
      // 境界制限を適用
      translateX.value = Math.min(Math.max(newX, -maxScrollX), maxScrollX);
      translateY.value = Math.min(Math.max(newY, -maxScrollY), maxScrollY);
    });

  // --- ジェスチャーの結合 (Simultaneous) ---
  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // --- 地図全体のアニメーションスタイル ---
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      transformOrigin: 'center center',
    };
  });
  
  return (
    <View style={styles.outerContainer}>
      <GestureDetector gesture={combinedGesture}>
        {/* ズームとパンが適用される地図全体 */}
        <Animated.View style={[styles.mapContainer, animatedStyle]}>
          <Image 
            source={require('../../assets/map.png')} // パスを確認/修正してください
            style={styles.mapImage} 
          />
          
          {/* 宝のマーカーを描画 */}
          {treasures.map((treasure) => {
            const treasurePoint = latLonToPixel(treasure.lat, treasure.lon);
            return (
              <TreasureMarker
                key={treasure.id}
                x={treasurePoint.x}
                y={treasurePoint.y}
                scale={scale} // Shared ValueをPropsとして渡す
                isFound={treasure.status === 'found'}
              />
            );
          })}
          
          {/* リアルタイムプレイヤーマーカー */}
          <PlayerMarker
            x={playerPoint.x}
            y={playerPoint.y}
            scale={scale} // Shared ValueをPropsとして渡す
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center', 
    justifyContent: 'center', 
    overflow: 'hidden', 
  },
  mapContainer: {
    width: IMG_WIDTH, 
    height: IMG_HEIGHT, 
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  marker: {
    position: 'absolute',
    width: 30, // マーカーサイズを少し大きく
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  playerMarker: {
    backgroundColor: 'red', // プレイヤーは赤
  },
  treasureMarker: {
    backgroundColor: 'blue', // 宝は青
  },
  markerText: {
    fontSize: 18,
    color: 'white',
  }
});
