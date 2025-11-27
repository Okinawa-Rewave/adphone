import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";

// 💡 react-native-gesture-handler をインポート
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/*
 * 位置情報(GPS)とカメラのパーミッションをリクエストする非同期関数
 */
async function requestPermissions() {
  if (Platform.OS === "android") {
    try {
      // 💡 GPS (ACCESS_FINE_LOCATION) と CAMERA のパーミッションのみをリクエスト
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
    } catch (err) {
      console.warn("Permission error:", err);
    }
  }
}


export default function RootLayout() {
  // 初回レンダリング時に位置情報とカメラパーミッションをリクエストする
  useEffect(() => {
    requestPermissions();
  }, []); 

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }
  
  // 💡 アプリケーションの最上位を GestureHandlerRootView で囲む
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
