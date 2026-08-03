// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { BleProvider } from "@/contexts/BleContext";
import { LpwaChatProvider } from "@/contexts/LpwaChatContext";
import { UIProvider, useUI } from "@/contexts/UIContext";
import { DisasterReportProvider } from "@/contexts/DisasterReportContext";
import { SideDrawer } from "@/components/SideDrawer";
import { CreatePostModal } from "@/components/CreatePostModal";
import { BleToFeedBridge } from "@/components/BleToFeedBridge";
import { GemmaResultToast } from "@/components/GemmaResultToast";

import { useEffect } from "react";
import { PermissionsAndroid, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initTrustSystem } from "@/lib/userTrust";
import GemmaModule from "@/lib/gemma";

const GEMMA_MODEL_PATH = "/sdcard/gemma-3n-E2B-it-int4.litertlm";

async function requestPermissions() {
  if (Platform.OS === "android") {
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);

      console.log("Permissions granted:", results);

      // 起動時にモデルをロード（ユーザー操作前にメモリを確保してクラッシュリスクを低減）
      const ok = await GemmaModule.initializeModel(GEMMA_MODEL_PATH);
      console.log("Gemma model initialized:", ok);
    } catch (err) {
      console.warn("Permission or Init error:", err);
    }
  }
}

/** SideDrawer・CreatePostModal・BleToFeedBridge をルートに配置するラッパー */
function RootOverlays() {
  const { isCreatePostOpen, closeCreatePost } = useUI();
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <BleToFeedBridge />
      <SideDrawer />
      <CreatePostModal visible={isCreatePostOpen} onClose={closeCreatePost} />
      <GemmaResultToast />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    requestPermissions();
    initTrustSystem().catch(console.warn);
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
            <LpwaChatProvider>
            <BleProvider>
              <UIProvider>
                <DisasterReportProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="chat/index" />
                  <Stack.Screen name="chat/[id]" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="map/index" />
                  <Stack.Screen name="camera/index" />
                  <Stack.Screen name="settings/index" />
                  <Stack.Screen name="settings/profile" />
                  <Stack.Screen name="settings/adphone" />
                  <Stack.Screen name="disaster/checklist" />
                  <Stack.Screen name="disaster/manual" />
                  <Stack.Screen name="disaster/emergency-contacts" />
                  <Stack.Screen name="ai/index" />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <RootOverlays />
                <StatusBar style="auto" />
                </DisasterReportProvider>
              </UIProvider>
            </BleProvider>
            </LpwaChatProvider>
          </NotificationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
