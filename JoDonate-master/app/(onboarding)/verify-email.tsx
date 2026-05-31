import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { reload } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { isEmailVerified, sendVerificationEmail } from "@/lib/auth-email";
import { auth } from "@/lib/firebase";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  text: "#2C2C2A",
  muted: "#888888",
};

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const onResend = async () => {
    if (!user || user.isAnonymous) return;
    try {
      setLoading(true);
      await sendVerificationEmail(user);
      Alert.alert("Sent", "Verification email sent again.");
    } catch (e: unknown) {
      Alert.alert("Error", firebaseAuthErrorMessage(e, "Could not send verification email."));
    } finally {
      setLoading(false);
    }
  };

  const onContinue = async () => {
    try {
      setLoading(true);
      if (auth.currentUser) await reload(auth.currentUser);
      if (isEmailVerified(auth.currentUser)) {
        router.replace("/(private)");
        return;
      }
      Alert.alert("Not verified yet", "Open the link in your email, then tap Continue.");
    } finally {
      setLoading(false);
    }
  };

  const onSkip = () => router.replace("/(private)");

  return (
    <View style={styles.screen}>
      <Ionicons name="mail-outline" size={56} color={C.primary} />
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>
        We sent a link to {user?.email ?? "your email"}. Verify to publish donations and send requests.
      </Text>
      <Pressable style={styles.primary} onPress={() => void onContinue()} disabled={loading}>
        <Text style={styles.primaryTxt}>{loading ? "Checking…" : "I verified — Continue"}</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={() => void onResend()} disabled={loading}>
        <Text style={styles.outlineTxt}>Resend email</Text>
      </Pressable>
      <Pressable onPress={onSkip}>
        <Text style={styles.skip}>Continue without verifying (limited)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  title: { fontSize: 24, fontWeight: "800", color: C.text },
  sub: { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
  primary: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    marginTop: 8,
  },
  primaryTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  outline: {
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  outlineTxt: { color: C.primary, fontWeight: "600" },
  skip: { color: C.muted, fontSize: 13, marginTop: 8 },
});
