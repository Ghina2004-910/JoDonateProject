import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
import { cardShadowSoft } from "@/lib/shadow-styles";
import { safeGoBack } from "@/lib/navigation";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  avatarBg: "#D4C4B0",
};

const MAX_W = 380;

export default function EditProfileScreen() {
  const router = useRouter();
  const user = getAuthUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profilePublic, setProfilePublic] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setEmail(user.email ?? "");
    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setName("");
          setPhone("");
          setCity("");
          setBio("");
          setAvatarUrl("");
          setLoading(false);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        setName(String(d.name ?? ""));
        setPhone(String(d.phone ?? ""));
        setCity(String(d.city ?? ""));
        setBio(String(d.bio ?? ""));
        setAvatarUrl(String(d.avatarUrl ?? ""));
        setProfilePublic(d.profilePublic !== false);
        setShowEmail(d.showEmail === true);
        setShowPhone(d.showPhone !== false);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  // ─── تم استبدال Firebase Storage بـ Cloudinary ─────────────────────────
  const pickAvatar = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    try {
      setSaving(true);
      const url = await uploadToCloudinary(uri);
      await setDoc(
        doc(db, "users", user.uid),
        { avatarUrl: url, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setAvatarUrl(url);
      Alert.alert("Saved", "Profile photo updated.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };
  // ───────────────────────────────────────────────────────────────────────

  const onSave = async () => {
    if (!user) return;
    const n = name.trim();
    if (!n) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }
    try {
      setSaving(true);
      const refDoc = doc(db, "users", user.uid);
      const snap = await getDoc(refDoc);
      const payload = {
        name: n,
        phone: phone.trim(),
        city: city.trim(),
        bio: bio.trim(),
        profilePublic,
        showEmail,
        showPhone,
        updatedAt: serverTimestamp(),
      };
      if (!snap.exists()) {
        await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(refDoc, payload);
      }
      Alert.alert("Success", "Profile updated successfully.", [
        { text: "OK", onPress: () => safeGoBack(router, "/profile") },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const initials = () => {
    const s = name.trim();
    if (s.length) return s.charAt(0).toUpperCase();
    const em = email.trim();
    return em.length ? em.charAt(0).toUpperCase() : "?";
  };

  if (!user) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>Sign in to edit your profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router, "/profile")} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          hitSlop={12}
          onPress={onSave}
          disabled={saving || loading}
          style={styles.headerIcon}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <Text style={styles.saveHeader}>Save</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            <Pressable onPress={pickAvatar} style={styles.avatarRow}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{initials()}</Text>
                  </View>
                )}
                <View style={styles.camBadge}>
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.changePhoto}>Change photo</Text>
            </Pressable>

            <Field label="Full name" requiredMark>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={C.muted}
                style={styles.input}
              />
            </Field>

            <Field label="Email">
              <TextInput
                value={email}
                editable={false}
                style={[styles.input, styles.inputDisabled]}
              />
            </Field>

            <Field label="Phone">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+962 …"
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </Field>

            <Field label="City / Location">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={C.muted}
                style={styles.input}
              />
            </Field>

            <Field label="Bio / About">
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about you"
                placeholderTextColor={C.muted}
                multiline
                style={[styles.input, styles.bioInput]}
              />
            </Field>

            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.card}>
              <ToggleRow
                label="Show phone"
                sub="Display phone on your public profile"
                value={showPhone}
                onValueChange={setShowPhone}
                last
              />
            </View>

            <Pressable
              style={[styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>Save changes</Text>
            </Pressable>

            <Pressable style={styles.btnOutline} onPress={() => safeGoBack(router, "/profile")}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <PrivateBottomNav active="profile" />
    </View>
  );
}

function Field({
  label,
  children,
  requiredMark,
}: {
  label: string;
  children: React.ReactNode;
  requiredMark?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {requiredMark ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
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
    <View style={[styles.toggleRow, !last && styles.toggleBorder]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: C.muted, fontWeight: "600" },
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
  headerIcon: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  saveHeader: { fontSize: 16, fontWeight: "700", color: C.primary },
  scroll: { paddingBottom: 120 },
  inner: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatarRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    backgroundColor: C.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 32, fontWeight: "800", color: C.text },
  camBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.card,
  },
  changePhoto: { fontSize: 13, fontWeight: "600", color: C.primary },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 6 },
  req: { color: "#E24B4A" },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    fontWeight: "500",
    color: C.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  inputDisabled: { opacity: 0.65 },
  bioInput: { minHeight: 96, textAlignVertical: "top" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    ...cardShadowSoft(),
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  toggleBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  toggleLabel: { fontSize: 14, fontWeight: "700", color: C.text },
  toggleSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  btnPrimary: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 52,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
    minHeight: 52,
  },
  btnOutlineText: { color: C.primary, fontSize: 16, fontWeight: "700" },
});
