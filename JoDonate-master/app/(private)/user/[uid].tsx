import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection, doc, onSnapshot,
  orderBy, query, where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Image,
  Pressable, ScrollView, StyleSheet, Text, View,
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

type ItemDoc = {
  id: string;
  title: string;
  imageUrl?: string;
  status?: string;
  createdAt?: any;
};

export default function PublicProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();

  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [loading, setLoading]           = useState(true);
  const [donationCount, setDonationCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [posts, setPosts]               = useState<ItemDoc[]>([]);

  // 1) بيانات المستخدم
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // 2) عدد التبرعات + المنشورات
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "items"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setDonationCount(snap.size);
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ItemDoc)));
    });
  }, [uid]);

  // 3) عدد الأشياء اللي أخدها
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "items"),
      where("recipientId", "==", uid),
      where("status", "==", "given")
    );
    return onSnapshot(q, (snap) => setReceivedCount(snap.size));
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
      ) : (
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
              <Ionicons name="checkmark-circle" size={22} color={C.green} style={styles.verifiedIcon} />
            )}
          </View>

          <Text style={styles.name}>{profile.name ?? "Donor"}</Text>

          {/* ✅ Counter Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{donationCount}</Text>
              <Text style={styles.statLabel}>Donations</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{receivedCount}</Text>
              <Text style={styles.statLabel}>Received</Text>
            </View>
          </View>

          {/* Info Card */}
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

          {/* ✅ Posts */}
          <Text style={styles.sectionTitle}>Posts</Text>
{posts.length === 0 ? (
  <Text style={styles.emptyText}>No posts yet.</Text>
) : (
  <View style={styles.postsGrid}>
    {posts.map((item) => (
      <Pressable
        key={item.id}
        style={styles.postCard}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.postImg} />
        ) : (
          <View style={[styles.postImg, styles.postImgPh]}>
            <Ionicons name="image-outline" size={28} color={C.muted} />
          </View>
        )}
        <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
        {item.status === "donated" && (
          <View style={styles.givenBadge}>
            <Text style={styles.givenText}>Given ✓</Text>
          </View>
        )}
      </Pressable>
    ))}
  </View>
)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:   { fontSize: 16, fontWeight: "700", color: C.text },
  content:       { alignItems: "center", padding: 24, paddingBottom: 40 },
  avatarWrap:    { position: "relative", marginBottom: 12 },
  avatar:        { width: 90, height: 90, borderRadius: 45 },
  avatarPh:      { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "700" },
  verifiedIcon:  { position: "absolute", bottom: 0, right: 0, backgroundColor: C.card, borderRadius: 11 },
  name:          { fontSize: 20, fontWeight: "700", color: C.text, marginBottom: 16 },

  // Stats
  statsRow:      { flexDirection: "row", gap: 16, marginBottom: 20 },
  statCard:      { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statNum:       { fontSize: 26, fontWeight: "800", color: C.primary },
  statLabel:     { fontSize: 13, color: C.muted, marginTop: 4 },

  // Info card
  card:          { width: "100%", backgroundColor: C.card, borderRadius: 12, padding: 16, gap: 14, marginBottom: 24 },
  row:           { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText:       { fontSize: 15, color: C.text },

  // Posts
  sectionTitle:  { alignSelf: "flex-start", fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 12 },
 postsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, width: "100%" },
postCard:  { width: "47%", backgroundColor: C.card, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.border },
postImg:   { width: "100%", height: 110 },
  postImgPh:     { backgroundColor: "#eee", alignItems: "center", justifyContent: "center" },
  postTitle:     { fontSize: 13, color: C.text, padding: 8 },
  givenBadge:    { position: "absolute", top: 6, right: 6, backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  givenText:     { color: "#fff", fontSize: 11, fontWeight: "700" },

  // Other
  privateBox:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  privateTitle:  { fontSize: 18, fontWeight: "700", color: C.text },
  privateSub:    { fontSize: 14, color: C.muted, textAlign: "center" },
  emptyText:     { textAlign: "center", marginTop: 20, color: C.muted },
});