// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { NotificationProvider } from "@/contexts/NotificationContext";

import { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";


/*
 * 位置情報(GPS)とカメラのパーミッションをリクエストする非同期関数
 */
async function requestPermissions() {
  if (Platform.OS === "android") {
    try {
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
  useEffect(() => {
    requestPermissions();
  }, []);

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {/* tabs というフォルダ前提をやめて、直下ルートへ */}
            <Stack.Screen name="index" />
            <Stack.Screen name="chat/index" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="chat/[roomId]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="map/index" />
            <Stack.Screen name="InteractiveMap" />
            <Stack.Screen name="camera" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="disaster/checklist" />
            <Stack.Screen name="disaster/manual" />
            <Stack.Screen name="disaster/emergency-contacts" />
            <Stack.Screen name="ai" />
            <Stack.Screen name="+not-found" />
          </Stack>

          <StatusBar style="auto" />
          {/*<StatusBar hidden />*/}
          </NotificationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
