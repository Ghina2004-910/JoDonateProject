import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { DemoRoleLogin } from "@/components/demo-role-login";
import { sendPasswordResetToEmail } from "@/lib/auth-password";
import { DEMO_ACCOUNTS, signInDemoAccount } from "@/lib/demo-accounts";
import { useAuth } from "@/lib/auth-context";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { auth } from "@/lib/firebase";
import { cardShadowMedium } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  darkBrown: "#8F7659",
  background: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  textSecondary: "#888888",
  inputBg: "#F0F0F0",
  border: "#E0E0E0",
  accentGreen: "#4CAF50",
  danger: "#E24B4A",
  btnHover: "#A38A78",
};

const MAX_W = 380;

function isValidEmail(value: string) {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidJordanPhone(value: string) {
  const d = value.trim().replace(/\s/g, "");
  return /^07\d{8}$/.test(d);
}

function isValidEmailOrPhone(value: string) {
  const t = value.trim();
  return isValidEmail(t) || isValidJordanPhone(t);
}

export default function SignInScreen() {
  const router = useRouter();
  const { signInDevBypass, signInGuestBypass } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldOk = useMemo(() => isValidEmailOrPhone(identifier), [identifier]);

  const onGuest = async () => {
    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      signInGuestBypass();
      router.replace("/(private)");
      return;
    }
    const guestAccount = DEMO_ACCOUNTS.find((a) => a.key === "guest");
    if (!guestAccount) return;
    try {
      await signInDemoAccount(guestAccount);
      router.replace("/(private)");
    } catch (e: unknown) {
      Alert.alert(
        "Guest access",
        e instanceof Error ? e.message : "Could not continue as guest.",
      );
    }
  };

  const onForgotPassword = async () => {
    const id = identifier.trim();
    if (isValidJordanPhone(id)) {
      Alert.alert(
        "Use email for reset",
        "Password reset is sent by email. Enter your account email above, then tap Forgot password again.",
      );
      return;
    }
    if (!isValidEmail(id)) {
      Alert.alert("Reset password", "Enter your email address in the field above first.");
      return;
    }
    try {
      setResetLoading(true);
      await sendPasswordResetToEmail(id);
      Alert.alert("Email sent", "Check your inbox for password reset instructions.");
    } catch (e: unknown) {
      Alert.alert(
        "Could not send",
        firebaseAuthErrorMessage(e, "Unable to send reset email. Check the address and try again."),
      );
    } finally {
      setResetLoading(false);
    }
  };

  const onLogin = async () => {
    setError(null);

    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      signInDevBypass();
      router.replace("/(private)");
      return;
    }

    const id = identifier.trim();
    if (!id || !password.trim()) {
      setError("Please enter email or phone and password.");
      return;
    }

    if (isValidJordanPhone(id)) {
      setError("Phone sign-in is not available yet. Use email or Continue as Guest.");
      return;
    }

    if (!isValidEmail(id)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, id, password);
      router.replace("/(private)");
    } catch (e: unknown) {
      setError(firebaseAuthErrorMessage(e, "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable
          hitSlop={14}
          style={styles.topIconBtn}
          onPress={() => router.replace("/(onboarding)")}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </Pressable>
        <Text style={styles.topBrand}>JO DONATE</Text>
        <Pressable
          hitSlop={14}
          style={styles.topIconBtn}
          onPress={() => router.replace("/(onboarding)")}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={C.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <Text style={styles.heroTitle}>Login</Text>
          <Text style={styles.heroSub}>Welcome back</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email or Phone</Text>
            <View
              style={[
                styles.inputWrap,
                error ? styles.inputWrapError : null,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Enter email or phone number"
                placeholderTextColor={C.textSecondary}
                autoCapitalize="none"
                keyboardType="default"
                autoCorrect={false}
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  setError(null);
                }}
              />
              {fieldOk ? (
                <Ionicons name="checkmark-circle" size={18} color={C.accentGreen} />
              ) : null}
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={C.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color={C.textSecondary}
                />
              </Pressable>
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <View style={styles.rememberRow}>
              <Pressable
                style={styles.rememberLeft}
                onPress={() => setRememberMe((v) => !v)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable onPress={() => void onForgotPassword()} disabled={resetLoading}>
                <Text style={[styles.forgotLink, resetLoading && styles.forgotLinkDisabled]}>
                  {resetLoading ? "Sending reset email…" : "Forgot password?"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginBtn,
                { transform: [{ scale: pressed && !loading ? 0.98 : 1 }] },
                loading && { opacity: 0.7 },
                pressed && !loading && { backgroundColor: C.btnHover },
              ]}
            >
              <Text style={styles.loginBtnText}>Login</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerOr}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.socialBtn}
              onPress={() => Alert.alert("Google", "Social sign-in coming soon.")}
            >
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </Pressable>
            <Pressable
              style={styles.socialBtn}
              onPress={() => Alert.alert("Facebook", "Social sign-in coming soon.")}
            >
              <Text style={styles.socialBtnText}>Continue with Facebook</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine}>
              <Text style={styles.footerMuted}>Don&apos;t have an account?</Text>
              <Pressable onPress={() => router.push("/sign-up")}>
                <Text style={styles.footerLink}> Sign Up</Text>
              </Pressable>
            </View>
            <View style={styles.footerLine}>
              <Text style={styles.footerMuted}>Login as Guest?</Text>
              <Pressable onPress={onGuest}>
                <Text style={styles.footerLink}> Continue as Guest</Text>
              </Pressable>
            </View>
          </View>

          <DemoRoleLogin compact />
        </ScrollView>
      </KeyboardAvoidingView>
  );

  if (Platform.OS === "web") return content;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {content}
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
    marginBottom: 8,
  },
  topIconBtn: {
    padding: 12,
    width: 48,
    alignItems: "center",
  },
  topBrand: {
    fontSize: 20,
    fontWeight: "800",
    color: C.primary,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 28,
  },
  card: {
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
    ...cardShadowMedium(),
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: C.text,
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 18,
    gap: 8,
  },
  inputWrapError: {
    borderColor: C.danger,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  errorBanner: {
    color: C.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: -10,
    marginBottom: 14,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  rememberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: C.primary,
  },
  rememberText: {
    fontSize: 14,
    color: C.text,
  },
  forgotLink: {
    fontSize: 14,
    color: C.primary,
    fontWeight: "600",
  },
  forgotLinkDisabled: {
    opacity: 0.6,
  },
  loginBtn: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 22,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  dividerOr: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "600",
  },
  socialBtn: {
    width: "100%",
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },
  footer: {
    marginTop: 22,
    gap: 14,
    alignItems: "center",
  },
  footerLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  footerMuted: {
    fontSize: 14,
    color: C.text,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: C.primary,
  },
});
