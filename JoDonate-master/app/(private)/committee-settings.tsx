import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "@/lib/cloudinaryService";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  err: "#C62828",
};

export default function CommitteeSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [committeeName, setCommitteeName] = useState("");
  const [committeeDescription, setCommitteeDescription] = useState("");
  const [committeePhone, setCommitteePhone] = useState("");
  const [committeeEmail, setCommitteeEmail] = useState("");
  const [committeeCity, setCommitteeCity] = useState("");
  const [workingHours, setWorkingHours] = useState("");
const [distributionPhotos, setDistributionPhotos] = useState<string[]>([]);
const [verified, setVerified] = useState(false);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      setAvatarUrl(d.avatarUrl ?? "");
      setCommitteeName(d.committeeName ?? "");
      setCommitteeDescription(d.committeeDescription ?? "");
      setCommitteePhone(d.committeePhone ?? "");
      setCommitteeEmail(d.committeeEmail ?? "");
      setCommitteeCity(d.committeeCity ?? "");
      setWorkingHours(d.workingHours ?? "");
  // ensure distributionPhotos is an array of strings
  const dist = d.distributionPhotos;
  setDistributionPhotos(Array.isArray(dist) ? dist : dist ? [dist] : []);
  setVerified(d.verified === true);
      setVerified(!!d.verified);
      setLoading(false);
    });
  }, []);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled) return;
    const uri = res.assets[0]?.uri;
    if (!uri) return;
    try {
      setUploadingImg(true);
      const url = await uploadToCloudinary(uri);
      const user = getAuthUser();
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), { avatarUrl: url });
      setAvatarUrl(url);
    } catch {
      Alert.alert("Error", "Failed to upload image.");
    } finally {
      setUploadingImg(false);
    }
  };
  const pickDistributionPhoto = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images" as ImagePicker.MediaType,
    quality: 0.85,
  });
  if (res.canceled) return;
  const uri = res.assets[0]?.uri;
  if (!uri) return;
  try {
    setUploadingImg(true);
    const url = await uploadToCloudinary(uri);
    setDistributionPhotos((prev) => [...prev, url]);
  } catch {
    Alert.alert("Error", "Failed to upload photo.");
  } finally {
    setUploadingImg(false);
  }
};

  const onSave = async () => {
    if (!committeeName.trim()) {
      Alert.alert("Error", "Committee name is required.");
      return;
    }
    const user = getAuthUser();
    if (!user) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "users", user.uid), {
        committeeName: committeeName.trim(),
        committeeDescription: committeeDescription.trim() || null,
        committeePhone: committeePhone.trim() || null,
        committeeEmail: committeeEmail.trim() || null,
        committeeCity: committeeCity.trim() || null,
        workingHours: workingHours.trim() || null,
        distributionPhotos: distributionPhotos || null,
        verified: verified || null,
      });
      Alert.alert("Saved", "Committee info updated successfully.");
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Committee Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Avatar */}
          <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploadingImg}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="people" size={36} color="#fff" />
              </View>
            )}
            <View style={styles.avatarEdit}>
              {uploadingImg ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change committee photo</Text>
          {verified && (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
    <Ionicons name="checkmark-circle" size={18} color="#1976D2" />
    <Text style={{ fontSize: 14, color: "#1976D2", fontWeight: "700" }}>Verified Committee</Text>
  </View>
)}

          {/* Fields */}
          <Text style={styles.label}>Committee Name *</Text>
          <TextInput
            style={styles.input}
            value={committeeName}
            onChangeText={setCommitteeName}
            placeholder="e.g. Helping Hearts Foundation"
            placeholderTextColor={C.muted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
            value={committeeDescription}
            onChangeText={setCommitteeDescription}
            placeholder="What does your committee do?"
            placeholderTextColor={C.muted}
            multiline
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={committeePhone}
            onChangeText={setCommitteePhone}
            placeholder="+9627XXXXXXXX"
            placeholderTextColor={C.muted}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={committeeEmail}
            onChangeText={setCommitteeEmail}
            placeholder="committee@example.com"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={committeeCity}
            onChangeText={setCommitteeCity}
            placeholder="e.g. Amman"
            placeholderTextColor={C.muted}
          />
          <Text style={styles.label}>Working Hours</Text>
<TextInput
  style={styles.input}
  value={workingHours}
  onChangeText={setWorkingHours}
  placeholder="e.g. Sat-Thu 9AM-5PM"
  placeholderTextColor={C.muted}
/>

<Text style={styles.label}>Distribution Photos</Text>
<View style={styles.photosRow}>
  {distributionPhotos.map((url, idx) => (
    <View key={idx} style={styles.photoWrap}>
      <Image source={{ uri: url }} style={styles.photoThumb} />
      <Pressable
        style={styles.photoRemove}
        onPress={() => setDistributionPhotos((prev) => prev.filter((_, i) => i !== idx))}
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
    </View>
  ))}
  {distributionPhotos.length < 10 && (
    <Pressable style={styles.photoAdd} onPress={pickDistributionPhoto} disabled={uploadingImg}>
      <Ionicons name="add" size={28} color={C.primary} />
    </Pressable>
  )}
</View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnTxt}>{saving ? "Saving…" : "Save Changes"}</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 52 : 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  content: { alignItems: "center", padding: 24 },
  avatarWrap: { position: "relative", marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPh: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: C.primary,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 12, color: C.muted, marginBottom: 20 },
  label: { alignSelf: "flex-start", fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 6, marginTop: 12 },
  input: {
    width: "100%",
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  saveBtn: {
    width: "100%",
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  photosRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  width: "100%",
  marginTop: 8,
},
photoWrap: { position: "relative" },
photoThumb: { width: 80, height: 80, borderRadius: 10 },
photoRemove: {
  position: "absolute",
  top: -6,
  right: -6,
  backgroundColor: "rgba(0,0,0,0.65)",
  borderRadius: 12,
  padding: 4,
},
photoAdd: {
  width: 80,
  height: 80,
  borderRadius: 10,
  backgroundColor: C.inputBg,
  borderWidth: 1,
  borderColor: C.border,
  alignItems: "center",
  justifyContent: "center",
},
});