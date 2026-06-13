import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
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
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";
import { conversationIdForPair } from "@/lib/chat-utils";
import { reviewEligibility } from "@/lib/eligibility-reviews";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  green: "#2E7D32",
  danger: "#E24B4A",
};

type Request = {
  id: string;
  requesterId: string;
  requesterName?: string;
  requestId?: string;
  status: string;
  createdAt?: unknown;
};

type UserInfo = {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
};

export default function CommitteeItemRequestsScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    const q = query(
  collection(db, "eligibilityReviews"),
  where("itemId", "==", itemId),
  orderBy("createdAt", "desc"),
);
    const unsub = onSnapshot(q, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Request, "id">) }));
      setRequests(rows);
      setLoading(false);

      const ids = Array.from(new Set(rows.map((r) => r.requesterId).filter(Boolean)));
      const newUsers: Record<string, UserInfo> = {};
      await Promise.all(
        ids.map(async (uid) => {
          const snap2 = await getDoc(doc(db, "users", uid));
          if (snap2.exists()) newUsers[uid] = snap2.data() as UserInfo;
        }),
      );
      setUsers(newUsers);
    });
    return unsub;
  }, [itemId]);

  const openChat = async (requesterId: string, requesterName: string) => {
    const me = getAuthUser()?.uid;
    if (!me) return;
    try {
      const conversationId = conversationIdForPair(me, requesterId);
      const accessId = `${requesterId}_${me}`;
      await setDoc(
        doc(db, "requestAccess", accessId),
        {
          itemId: itemId ?? "committee_direct",
          requesterId,
          itemOwnerId: me,
        },
        { merge: true },
      );
      await setDoc(
        doc(db, "conversations", conversationId),
        {
          participants: [me, requesterId],
          participantNames: {
            [me]: "Committee",
            [requesterId]: requesterName,
          },
          itemId: itemId,
          lastMessageAt: serverTimestamp(),
          unreadBy: { [requesterId]: 1 },
          blocked: false,
          archivedFor: [],
        },
        { merge: true },
      );
      router.push({
  pathname: "/chats/[conversationId]",
  params: { 
    conversationId, 
    committeeChat: "true",
  },
});
    } catch {
      Alert.alert("Error", "Could not open chat.");
    }
  };
  const reviewRequest = async (reviewId: string, requesterId: string, status: "approved" | "rejected") => {
  const me = getAuthUser()?.uid;
  if (!me) return;
  try {
    await reviewEligibility(reviewId, status, me);
    Alert.alert(
      status === "approved" ? "Approved ✓" : "Rejected",
      status === "approved"
        ? "The requester has been notified."
        : "The request has been rejected.",
    );
  } catch {
    Alert.alert("Error", "Could not update the request.");
  }
};

  const statusColor = (status: string) => {
    if (status === "approved") return C.green;
    if (status === "rejected") return C.danger;
    return "#E8A317";
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Item Requests</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : requests.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={C.muted} />
          <Text style={styles.emptyText}>No requests yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {requests.map((req) => {
            const user = users[req.requesterId];
            return (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardTop}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPh]}>
                      <Text style={styles.avatarInitial}>
                        {(user?.name ?? req.requesterName ?? "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{user?.name ?? req.requesterName ?? "User"}</Text>
                    {user?.email && <Text style={styles.meta}>{user.email}</Text>}
                    {user?.phone && <Text style={styles.meta}>{user.phone}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(req.status) }]}>
                    <Text style={styles.statusText}>{req.status}</Text>
                  </View>
                </View>

{req.status === "pending" && (
  <View style={{ flexDirection: "row", gap: 8 }}>
    <Pressable
      style={[styles.actionBtn, { backgroundColor: C.green, flex: 1 }]}
      onPress={() => reviewRequest(req.id, req.requesterId, "approved")}
    >
      <Ionicons name="checkmark-outline" size={16} color="#fff" />
      <Text style={styles.actionBtnTxt}>Approve</Text>
    </Pressable>
    <Pressable
      style={[styles.actionBtn, { backgroundColor: C.danger, flex: 1 }]}
      onPress={() => reviewRequest(req.id, req.requesterId, "rejected")}
    >
      <Ionicons name="close-outline" size={16} color="#fff" />
      <Text style={styles.actionBtnTxt}>Reject</Text>
    </Pressable>
  </View>
)}

<Pressable
  style={styles.chatBtn}
  onPress={() => openChat(req.requesterId, user?.name ?? req.requesterName ?? "User")}
>
  <Ionicons name="chatbubble-outline" size={16} color="#fff" />
  <Text style={styles.chatBtnText}>Message Requester</Text>
</Pressable>
              </View>
            );
          })}
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
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPh: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 18 },
  name: { fontSize: 15, fontWeight: "700", color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 2 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  chatBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: C.muted },
  actionBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: 10,
  paddingVertical: 12,
},
actionBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

});