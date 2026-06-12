import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  green: "#2E7D32",
};

type UserProfile = {
  name?: string;
  city?: string;
  bio?: string;
  phone?: string;
  avatarUrl?: string;
  verified?: boolean;
  profilePublic?: boolean;
  showPhone?: boolean;
};

export default function PublicProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Donor Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={C.primary} />
      ) : !profile ? (
        <Text style={styles.emptyText}>User not found.</Text>
      ) : !profile.profilePublic ? (
        // ── Private account ──
        <View style={styles.privateBox}>
          <Ionicons name="lock-closed-outline" size={48} color={C.muted} />
          <Text style={styles.privateTitle}>Private Account</Text>
          <Text style={styles.privateSub}>
            This user has set their profile to private.
          </Text>
        </View>
      ) : (
        // ── Public profile ──
        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Text style={styles.avatarInitial}>
                  {(profile.name ?? "D").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {profile.verified && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={C.green}
                style={styles.verifiedIcon}
              />
            )}
          </View>

          {/* Name */}
          <Text style={styles.name}>{profile.name ?? "Donor"}</Text>

          {/* Info rows */}
          <View style={styles.card}>
            {!!profile.city && (
              <View style={styles.row}>
                <Ionicons name="location-outline" size={18} color={C.primary} />
                <Text style={styles.rowText}>{profile.city}</Text>
              </View>
            )}
            {!!profile.bio && (
              <View style={[styles.row, { alignItems: "flex-start" }]}>
                <Ionicons name="person-outline" size={18} color={C.primary} />
                <Text style={[styles.rowText, { flex: 1 }]}>{profile.bio}</Text>
              </View>
            )}
            {profile.showPhone && !!profile.phone && (
              <View style={styles.row}>
                <Ionicons name="call-outline" size={18} color={C.primary} />
                <Text style={styles.rowText}>{profile.phone}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:   { fontSize: 16, fontWeight: "700", color: C.text },
  content:       { alignItems: "center", padding: 24 },
  avatarWrap:    { position: "relative", marginBottom: 12 },
  avatar:        { width: 90, height: 90, borderRadius: 45 },
  avatarPh:      { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "700" },
  verifiedIcon:  { position: "absolute", bottom: 0, right: 0, backgroundColor: C.card, borderRadius: 11 },
  name:          { fontSize: 20, fontWeight: "700", color: C.text, marginBottom: 20 },
  card:          { width: "100%", backgroundColor: C.card, borderRadius: 12, padding: 16, gap: 14 },
  row:           { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText:       { fontSize: 15, color: C.text },
  privateBox:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  privateTitle:  { fontSize: 18, fontWeight: "700", color: C.text },
  privateSub:    { fontSize: 14, color: C.muted, textAlign: "center" },
  emptyText:     { textAlign: "center", marginTop: 60, color: C.muted },
});
