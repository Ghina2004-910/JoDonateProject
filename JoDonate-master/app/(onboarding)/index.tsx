import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DemoRoleLogin } from "@/components/demo-role-login";
import { DEMO_ACCOUNTS, signInDemoAccount } from "@/lib/demo-accounts";
import { useAuth } from "@/lib/auth-context";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  darkBrown: "#8F7659",
  background: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  textSecondary: "#888888",
  guestBg: "#D4C4B0",
  guestPressed: "#C4B29E",
  createHover: "#A38A78",
  loginHover: "#8F7659",
};

const MAX_W = 380;
const PAD_H = 24;
const BTN_R = 16;

export default function WelcomeScreen() {
  const router = useRouter();
  const { signInGuestBypass } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);

  const onGuest = async () => {
    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      signInGuestBypass();
      router.replace("/(private)");
      return;
    }
    const guestAccount = DEMO_ACCOUNTS.find((a) => a.key === "guest");
    if (!guestAccount) return;
    try {
      setGuestLoading(true);
      await signInDemoAccount(guestAccount);
      router.replace("/(private)");
    } catch (e: unknown) {
      Alert.alert(
        "Guest access",
        e instanceof Error ? e.message : "Could not continue as guest.",
      );
    } finally {
      setGuestLoading(false);
    }
  };

  const features = [
    { icon: "search-outline" as const, label: "Browse Donations" },
    { icon: "hand-left-outline" as const, label: "Find Help" },
    { icon: "heart-outline" as const, label: "Make Impact" },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollInner}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.column}>
        <Text style={styles.logo}>JO DONATE</Text>
        <Text style={styles.tagline}>Share, Help, Donate</Text>

        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <Ionicons name={f.icon} size={22} color={C.primary} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.btnBlock}>
          <Pressable
            onPress={() => router.push("/sign-up")}
            style={({ pressed }) => [
              styles.btn,
              styles.btnCreate,
              pressed && { backgroundColor: C.createHover },
            ]}
          >
            <Text style={styles.btnTextLight}>Create Account</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/login")}
            style={({ pressed }) => [
              styles.btn,
              styles.btnLogin,
              pressed && { backgroundColor: C.loginHover },
            ]}
          >
            <Text style={styles.btnTextLight}>Login</Text>
          </Pressable>

          <Pressable
            onPress={onGuest}
            disabled={guestLoading}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGuest,
              guestLoading && { opacity: 0.75 },
              pressed && !guestLoading && { backgroundColor: C.guestPressed },
            ]}
          >
            {guestLoading ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              <Text style={styles.btnTextGuest}>Continue as Guest</Text>
            )}
          </Pressable>
        </View>

        <DemoRoleLogin />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollInner: {
    flexGrow: 1,
    paddingHorizontal: PAD_H,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    alignItems: "center",
  },
  column: {
    width: "100%",
    maxWidth: MAX_W,
  },
  logo: {
    fontSize: 34,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 28,
  },
  features: {
    marginBottom: 32,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
  },
  btnBlock: {
    width: "100%",
    gap: 20,
  },
  btn: {
    width: "100%",
    minHeight: 52,
    borderRadius: BTN_R,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCreate: {
    backgroundColor: C.secondary,
  },
  btnLogin: {
    backgroundColor: C.primary,
  },
  btnGuest: {
    backgroundColor: C.guestBg,
  },
  btnTextLight: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  btnTextGuest: {
    color: C.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
