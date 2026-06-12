import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  DevSettings,
  I18nManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { sendPasswordResetToEmail } from "@/lib/auth-password";
import {
  accountDeletionErrorMessage,
  deleteAccountPermanently,
} from "@/lib/account-deletion";
import { getAuthUser } from "@/lib/auth-user";
import { useAuth } from "@/lib/auth-context";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { auth, db } from "@/lib/firebase";
import { type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  danger: "#E24B4A",
  iconTan: "#EDE5DE",
};

const MAX_W = 380;

export default function SettingsScreen() {
  const router = useRouter();
  const { signOutApp } = useAuth();
  const { locale, setAppLocale, t } = useLocale();
  const user = getAuthUser();

  const [lang, setLang] = useState<Locale>(locale);
  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  useEffect(() => {
    setLang(locale);
  }, [locale]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    getDoc(ref).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as Record<string, unknown>;
      setShowEmail(d.showEmail === true);
      setShowPhone(d.showPhone !== false);
    });
  }, [user]);

  const persistPrivacy = useCallback(
    async (patch: Record<string, boolean | string>) => {
      if (!user || SKIP_FIREBASE_AUTH) return;
      try {
        await updateDoc(doc(db, "users", user.uid), patch);
      } catch {
        Alert.alert("Error", "Could not update settings.");
      }
    },
    [user],
  );

  const onChangeEmail = () => {
    Alert.alert(
      "Change email",
      "For security, email updates are handled by support. Reach out at support@jodonate.app.",
    );
  };

  const onChangePasswordNav = () => {
    Alert.alert("Change password", "Open the Profile tab and use Change Password under Account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Go to Profile", onPress: () => router.push("/profile") },
    ]);
  };

  const onResetPassword = async () => {
    if (!user?.email) {
      Alert.alert("No email", "This account has no email address linked for password reset.");
      return;
    }
    if (__DEV__ && SKIP_FIREBASE_AUTH) {
      Alert.alert("Dev mode", "Password reset is disabled in preview.");
      return;
    }
    try {
      setResetLoading(true);
      await sendPasswordResetToEmail(user.email);
      Alert.alert("Sent", "Check your inbox for reset instructions.");
    } catch (e: unknown) {
      Alert.alert("Error", firebaseAuthErrorMessage(e, "Failed to send reset email."));
    } finally {
      setResetLoading(false);
    }
  };

  const onDownloadData = () => {
    Alert.alert(
      "Download data",
      "We’ll email you an export when this feature is connected to the backend.",
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently removes your login and Firestore data. You will need your current password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue in Profile",
          onPress: () => router.push("/profile"),
        },
        {
          text: "Delete now",
          style: "destructive",
          onPress: async () => {
            if (__DEV__ && SKIP_FIREBASE_AUTH) {
              Alert.alert("Dev mode", "Account deletion is disabled in preview.");
              return;
            }
            if (!auth.currentUser) return;
            try {
              await deleteAccountPermanently();
              await signOutApp();
              router.replace("/(onboarding)");
              Alert.alert("Account deleted", "Your account and data were permanently removed.");
            } catch (e: unknown) {
              Alert.alert(
                "Cannot delete",
                accountDeletionErrorMessage(e),
                [
                  { text: "OK" },
                  {
                    text: "Open Profile",
                    onPress: () => router.push("/profile"),
                  },
                ],
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router, "/profile")} style={styles.hit}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("settings")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
        <SectionTitle title={t("account")} />        
        <Card>
            <LinkRow
              icon="mail-outline"
              label={t("changeEmail")}
              onPress={onChangeEmail}
            />
            <LinkRow icon="key-outline" label={t("changePassword")} last onPress={onChangePasswordNav} />
          </Card>
          <SectionTitle title={t("preferences")} />
          <Card>
            <Pressable
              style={[styles.row, styles.rowBorder, { borderBottomWidth: 0 }]}
              onPress={async () => {
                const next: Locale = lang === "en" ? "ar" : "en";
                setLang(next);
                await setAppLocale(next);
                const rtlChanged = (next === "ar") !== I18nManager.isRTL;
                if (rtlChanged) {
                  Alert.alert(
                    next === "ar" ? "إعادة التشغيل" : "Restart app",
                    next === "ar"
                      ? "أعد فتح التطبيق لتطبيق اتجاه العربية."
                      : "Please restart the app to apply the new layout direction.",
                    [
                      { text: next === "ar" ? "لاحقاً" : "Later", style: "cancel" },
                      {
                        text: next === "ar" ? "إعادة التشغيل" : "Restart",
                        onPress: () => DevSettings.reload?.(),
                      },
                    ],
                  );
                }
              }}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="language-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t("language")}</Text>
                <Text style={styles.rowSub}>{lang === "en" ? t("english") : t("arabic")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Pressable>
          </Card>

          <SectionTitle title={t("privacy")} />
          <Card>
            <RowToggle
              label={t("showPhone")}
              sub="On your public profile"
              value={showPhone}
              onValueChange={(v) => {
                setShowPhone(v);
                persistPrivacy({ showPhone: v });
              }}
            />
            <RowToggle
              label={t("showEmail")}
              sub={t("onPublicProfile")}
              value={showEmail}
              onValueChange={(v) => {
                setShowEmail(v);
                persistPrivacy({ showEmail: v });
              }}
            />
            <RowToggle
              label={t("allowMessages")}
              sub={t("otherUsersCanChat")}
              value={allowMessages}
              onValueChange={setAllowMessages}
              last
            />
          </Card>

          <SectionTitle title={t("data")} />
          <Card>
            <LinkRow icon="download-outline" label={t("downloadMyData")} onPress={onDownloadData} />
            <Pressable style={[styles.row]} onPress={onDeleteAccount}>
              <View style={styles.iconCircle}>
                <Ionicons name="trash-outline" size={20} color={C.danger} />
              </View>
              <Text style={[styles.rowTitle, { color: C.danger, flex: 1 }]}>{t("deleteAccount")}</Text>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function LinkRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, !last && styles.rowBorder]} onPress={onPress}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={C.primary} />
      </View>
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={C.muted} />
    </Pressable>
  );
}

function RowToggle({
  label,
  sub,
  value,
  onValueChange,
  last,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, styles.togglePad, !last && styles.rowBorder]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D0D0D0", true: "#C4A88E" }}
        thumbColor={value ? C.primary : "#f4f3f4"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  hit: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  scroll: { paddingBottom: 40 },
  inner: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    ...cardShadowSoft(),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  toggleCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    ...cardShadowSoft(),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  togglePad: { justifyContent: "space-between" },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.iconTan,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: "500" },
});