/**
 * app/admin/_layout.tsx
 * 自治体ポータル — パスワード認証ゲート + タブナビゲーション
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Tabs } from "expo-router";
import { LayoutDashboard, Users, FileText, Map, Lock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Design } from "@/constants/Design";

const ADMIN_PASSWORD = "admin1234";

function PasswordScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const insets = useSafeAreaInsets();

  const tryLogin = () => {
    if (pw === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setPw("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.gate, { paddingTop: insets.top + 60 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.lockIcon}>
        <Lock size={36} color={Design.colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.gateTitle}>自治体ポータル</Text>
      <Text style={styles.gateSubtitle}>管理者パスワードを入力してください</Text>

      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="パスワード"
        placeholderTextColor={Design.colors.textMuted}
        secureTextEntry
        value={pw}
        onChangeText={(t) => { setPw(t); setError(false); }}
        onSubmitEditing={tryLogin}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={styles.errorText}>パスワードが正しくありません</Text>}

      <TouchableOpacity style={styles.loginBtn} onPress={tryLogin} activeOpacity={0.85}>
        <Text style={styles.loginBtnText}>ログイン</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

export default function AdminLayout() {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <PasswordScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Design.colors.background,
          borderTopColor: Design.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Design.colors.primary,
        tabBarInactiveTintColor: Design.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Design.fontWeight.semi,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "概要",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarLabel: "ユーザー",
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarLabel: "報告一覧",
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: "地図",
          tabBarIcon: ({ color, size }) => (
            <Map size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: Design.colors.background,
    paddingHorizontal: Design.spacing.xl,
    alignItems: "center",
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: Design.radius.xl,
    backgroundColor: Design.colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Design.spacing.lg,
  },
  gateTitle: {
    fontSize: Design.fontSize.titleLarge,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
    marginBottom: Design.spacing.xs,
  },
  gateSubtitle: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textMuted,
    marginBottom: Design.spacing.xl,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.md,
    paddingVertical: Design.spacing.md,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    backgroundColor: Design.colors.surface,
    marginBottom: Design.spacing.sm,
  },
  inputError: {
    borderColor: Design.colors.danger,
  },
  errorText: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.danger,
    marginBottom: Design.spacing.sm,
    alignSelf: "flex-start",
  },
  loginBtn: {
    width: "100%",
    backgroundColor: Design.colors.primary,
    borderRadius: Design.radius.md,
    paddingVertical: Design.spacing.md,
    alignItems: "center",
    marginTop: Design.spacing.xs,
  },
  loginBtnText: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.white,
  },
});
