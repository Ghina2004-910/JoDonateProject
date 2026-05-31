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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { DEMO_ACCOUNTS, signInDemoAccount } from "@/lib/demo-accounts";
import { useAuth } from "@/lib/auth-context";
import { sendVerificationEmail } from "@/lib/auth-email";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";
import { ROUTES } from "@/lib/app-routes";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { auth, db } from "@/lib/firebase";
import { cardShadowMedium } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
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

function isValidPhone(value: string) {
  const d = value.trim().replace(/\s/g, "");
  return /^07\d{8}$/.test(d);
}

function passwordStrength(pw: string): "weak" | "medium" | "strong" {
  if (pw.length < 6) return "weak";
  if (pw.length < 10) return "medium";
  return "strong";
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signInDevBypass, signInGuestBypass } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = useMemo(() => name.trim().length > 0, [name]);
  const phoneOk = useMemo(() => isValidPhone(phone), [phone]);
  const emailOk = useMemo(() => isValidEmail(email), [email]);
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

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

  const onSignUp = async () => {
    setError(null);

    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      signInDevBypass();
      router.replace("/(private)");
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim().replace(/\s/g, "");

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Enter a valid phone number (e.g. 0799824354).");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setError("Please accept the Terms & Conditions and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: "user",
        createdAt: serverTimestamp(),
      });
      try {
        await sendVerificationEmail(cred.user);
      } catch (e: unknown) {
        Alert.alert(
          "Verification email",
          firebaseAuthErrorMessage(
            e,
            "Account created but verification email could not be sent. Use Resend on the next screen.",
          ),
        );
      }
      router.replace(ROUTES.verifyEmail);
    } catch (e: unknown) {
      setError(firebaseAuthErrorMessage(e, "Sign up failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const strengthColor =
    strength === "weak" ? C.textSecondary : strength === "medium" ? "#C9A227" : C.accentGreen;

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
        >
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </Pressable>
        <Text style={styles.topBrand}>JO DONATE</Text>
        <Pressable
          hitSlop={14}
          style={styles.topIconBtn}
          onPress={() => router.replace("/(onboarding)")}
        >
          <Ionicons name="close" size={24} color={C.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <Text style={styles.heroTitle}>Sign Up</Text>
          <Text style={styles.heroSub}>Create your account</Text>

          <View style={styles.card}>
            <Field
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              ok={nameOk}
              autoCapitalize="words"
            />

            <Field
              label="Phone Number"
              placeholder="+9627XXXXXXXX"
              value={phone}
              onChangeText={setPhone}
              ok={phoneOk}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Field
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              ok={emailOk}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={C.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color={C.textSecondary}
                />
              </Pressable>
            </View>
            <Text style={[styles.strength, { color: strengthColor }]}>
              Password strength: {strength.charAt(0).toUpperCase() + strength.slice(1)}
            </Text>

            <Text style={[styles.label, { marginTop: 8 }]}>Confirm Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor={C.textSecondary}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable onPress={() => setShowConfirm((v) => !v)}>
                <Ionicons
                  name={showConfirm ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color={C.textSecondary}
                />
              </Pressable>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <Text style={styles.fieldError}>Passwords must match</Text>
            ) : null}

            <CheckboxRow
              checked={agreeTerms}
              onToggle={() => setAgreeTerms((v) => !v)}
              labelBefore="I agree to the "
              linkText="Terms & Conditions"
              onLinkPress={() => Alert.alert("Terms", "Terms & Conditions (placeholder).")}
            />

            <CheckboxRow
              checked={agreePrivacy}
              onToggle={() => setAgreePrivacy((v) => !v)}
              labelBefore="I agree to the "
              linkText="Privacy Policy"
              onLinkPress={() => Alert.alert("Privacy", "Privacy Policy (placeholder).")}
            />

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Pressable
              onPress={onSignUp}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                loading && { opacity: 0.7 },
                pressed && !loading && { backgroundColor: C.btnHover },
              ]}
            >
              <Text style={styles.submitBtnText}>Create Account</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine}>
              <Text style={styles.footerMuted}>Already have an account?</Text>
              <Pressable onPress={() => router.replace("/login")}>
                <Text style={styles.footerLink}> Login</Text>
              </Pressable>
            </View>
            <View style={styles.footerLine}>
              <Text style={styles.footerMuted}>Continue as Guest</Text>
              <Pressable onPress={onGuest}>
                <Text style={styles.footerLink}> Guest</Text>
              </Pressable>
            </View>
          </View>
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

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  ok,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  ok: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "words";
  maxLength?: number;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.textSecondary}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
        />
        {ok ? (
          <Ionicons name="checkmark-circle" size={18} color={C.accentGreen} />
        ) : null}
      </View>
    </>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  labelBefore,
  linkText,
  onLinkPress,
}: {
  checked: boolean;
  onToggle: () => void;
  labelBefore: string;
  linkText: string;
  onLinkPress: () => void;
}) {
  return (
    <View style={styles.checkRow}>
      <Pressable onPress={onToggle} hitSlop={6}>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
      <Text style={styles.checkLabel}>
        {labelBefore}
        <Text style={styles.checkLink} onPress={onLinkPress}>
          {linkText}
        </Text>
      </Text>
    </View>
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
    paddingBottom: 48,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 24,
  },
  card: {
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 26,
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
  input: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  strength: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: -12,
    marginBottom: 14,
  },
  fieldError: {
    color: C.danger,
    fontSize: 12,
    fontWeight: "600",
    marginTop: -12,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: C.primary,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    lineHeight: 20,
  },
  checkLink: {
    color: C.primary,
    fontWeight: "700",
  },
  errorBanner: {
    color: C.danger,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
