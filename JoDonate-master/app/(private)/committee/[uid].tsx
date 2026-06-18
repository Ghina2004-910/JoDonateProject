import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, serverTimestamp , setDoc,doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
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

type CommitteeProfile = {
  name?: string;
  avatarUrl?: string;
  committeeName?: string;
  committeeDescription?: string;
  committeePhone?: string;
  committeeEmail?: string;
  committeeCity?: string;
  committeeId?: string;
  role?: string;
  verified?: boolean;
  workingHours?: string;
  distributionPhotos?: string[];
};

type Member = {
  id: string;
  name?: string;
  avatarUrl?: string;
  committeeId?: string;
};

export default function CommitteeProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CommitteeProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as CommitteeProfile) : null);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!profile?.committeeId) return;
    const q = query(
      collection(db, "users"),
      where("role", "==", "committee"),
      where("committeeId", "==", profile.committeeId),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMembers(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, "id">) })),
      );
    });
    return unsub;
  }, [profile?.committeeId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Committee Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={C.primary} />
      ) : !profile ? (
        <Text style={styles.emptyText}>Committee not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar + Name */}
          <View style={styles.avatarWrap}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="people" size={36} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.committeeName}>
            {profile.committeeName ?? profile.name ?? "Committee"}
            {profile.verified && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Ionicons name="checkmark-circle" size={18} color="#1976D2" />
              <Text style={{ fontSize: 14, color: "#1976D2", fontWeight: "700" }}>Verified Committee</Text>
            </View>
          )}
            {profile.verified && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Ionicons name="checkmark-circle" size={18} color="#1976D2" />
            </View>
          )}
          </Text>
          {profile.committeeCity ? (
            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={16} color={C.muted} />
              <Text style={styles.cityText}>{profile.committeeCity}</Text>
            </View>
          ) : null}

          {/* Info Card */}
          <View style={styles.card}>
            {!!profile.committeeDescription && (
              <View style={styles.row}>
                <Ionicons name="information-circle-outline" size={18} color={C.primary} />
                <Text style={[styles.rowText, { flex: 1 }]}>{profile.committeeDescription}</Text>
              </View>
            )}
            {!!profile.committeePhone && (
              <View style={styles.row}>
                <Ionicons name="call-outline" size={18} color={C.primary} />
                <Text style={styles.rowText}>{profile.committeePhone}</Text>
              </View>
            )}
            {!!profile.committeeEmail && (
              <View style={styles.row}>
                <Ionicons name="mail-outline" size={18} color={C.primary} />
                <Text style={styles.rowText}>{profile.committeeEmail}</Text>
              </View>
            )}
          </View>

          {/* Working Hours */}
{!!profile.workingHours && (
  <>
    <Text style={styles.sectionTitle}>Working Hours</Text>
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={18} color={C.primary} />
        <Text style={styles.rowText}>{profile.workingHours}</Text>
      </View>
    </View>
  </>
)}

{/* Distribution Photos */}
{profile.distributionPhotos && profile.distributionPhotos.length > 0 && (
  <>
    <Text style={styles.sectionTitle}>Distribution Photos</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: "100%" }}>
      <View style={{ flexDirection: "row", gap: 10, paddingVertical: 8 }}>
        {profile.distributionPhotos.map((url: string, idx: number) => (
          <Image key={idx} source={{ uri: url }} style={{ width: 120, height: 120, borderRadius: 12 }} />
        ))}
      </View>
    </ScrollView>
  </>
)}

{/* Message Button */}
<Pressable
  style={[styles.card, { backgroundColor: C.primary, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }]}
 onPress={async () => {
  const { getAuthUser } = require("@/lib/auth-user");
  const me = getAuthUser()?.uid;
  if (!me) {
    Alert.alert("Sign in required", "Please sign in to message.");
    return;
  }
  if (me === uid) return;

  // Check if user has approved request
  const { getDocs, collection: col, query: q, where } = require("firebase/firestore");
 const { DEFAULT_COMMITTEE_ID } = require("@/lib/committees");
  const accessSnap = await getDocs(q(
    col(db, "eligibilityReviews"),
    where("requesterId", "==", me),
    where("committeeId", "==", profile.committeeId ?? DEFAULT_COMMITTEE_ID),
    where("status", "==", "approved"),
  ));

  if (accessSnap.empty) {
    Alert.alert(
      "Request required",
      "You need to submit a donation request first. The committee will contact you after approval.",
    );
    return;
  }

  try {
    const { conversationIdForPair } = require("@/lib/chat-utils");
    const { setDoc, doc: fsDoc, serverTimestamp } = require("firebase/firestore");
    const conversationId = conversationIdForPair(me, uid);
    await setDoc(
      fsDoc(db, "conversations", conversationId),
      {
        participants: [me, uid],
        participantNames: {
          [me]: "User",
          [uid]: profile.committeeName ?? "Committee",
        },
        lastMessageAt: serverTimestamp(),
        unreadBy: {},
        blocked: false,
        archivedFor: [],
      },
      { merge: true },
    );
    router.push({
      pathname: "/chats/[conversationId]",
      params: { conversationId },
    });
  } catch {
    Alert.alert("Error", "Could not open chat.");
  }
}}
>
  <Ionicons name="chatbubble-outline" size={20} color="#fff" />
  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Message Committee</Text>
</Pressable>
        </ScrollView>
      )}
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
  content: { alignItems: "center", padding: 24, gap: 12 },
  avatarWrap: { marginBottom: 8 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPh: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  committeeName: { fontSize: 22, fontWeight: "800", color: C.text },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cityText: { fontSize: 14, color: C.muted },
  card: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowText: { fontSize: 14, color: C.text },
  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 15,
    fontWeight: "800",
    color: C.text,
    marginTop: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  memberBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberAvatarPh: {
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitial: { color: "#fff", fontWeight: "700", fontSize: 16 },
  memberName: { flex: 1, fontSize: 14, fontWeight: "600", color: C.text },
  roleBadge: {
    backgroundColor: C.primary + "20",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700", color: C.primary },
  emptyText: { textAlign: "center", marginTop: 60, color: C.muted },
});