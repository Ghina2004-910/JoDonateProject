import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { useAuth } from "@/lib/auth-context";
import { getAuthUser } from "@/lib/auth-user";
import { peerFromConv } from "@/lib/chat-utils";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  tan: "#D4C4B0",
  badge: "#E24B4A",
};

const MAX_W = 380;

type ConvRow = {
  id: string;
  peerId: string;
  peerName: string;
  lastMessageText: string;
  lastMessageAt: Timestamp | null;
  unread: number;
  blocked?: boolean;
  archivedFor?: string[];
};

function formatConvTime(ts: Timestamp | null): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (dayStart - msgDay === 86400_000) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesListScreen() {
  const router = useRouter();
  const { limitedGuest } = useAuth();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!limitedGuest) return;
    Alert.alert("Please login to use chat", "Sign in to message donors and buyers.", [
      { text: "Cancel", style: "cancel", onPress: () => safeGoBack(router) },
      { text: "Login", onPress: () => router.replace("/login") },
      { text: "Sign Up", onPress: () => router.replace("/sign-up") },
    ]);
  }, [limitedGuest, router]);

  const uid = getAuthUser()?.uid;

  useEffect(() => {
    if (!uid || limitedGuest) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      orderBy("lastMessageAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
       const list: ConvRow[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as {
            participants?: string[];
            participantNames?: Record<string, string>;
            lastMessageText?: string;
            lastMessageAt?: Timestamp | null;
            unreadBy?: Record<string, number>;
            blocked?: boolean;
            archivedFor?: string[];
          };
          if (data.archivedFor?.includes(uid)) return;
          const peerId = peerFromConv(docSnap.id, uid);
          if (!peerId) return;
          const peerName = data.participantNames?.[peerId] ?? "User";
          list.push({
            id: docSnap.id,
            peerId,
            peerName,
            lastMessageText: data.lastMessageText ?? "",
            lastMessageAt: data.lastMessageAt ?? null,
            unread: data.unreadBy?.[uid] ?? 0,
            blocked: data.blocked,
            archivedFor: data.archivedFor,
          });
        });
        setRows(list);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("Conversations listener:", err);
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsub;
  }, [uid, limitedGuest]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.peerName.toLowerCase().includes(q) ||
        r.lastMessageText.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  if (limitedGuest) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>Sign in to view messages</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <Pressable hitSlop={12} style={styles.iconBtn} onPress={() => {}} accessibilityLabel="Search">
            <Ionicons name="search-outline" size={22} color={C.primary} />
          </Pressable>
          <Pressable
            hitSlop={12}
            style={styles.iconBtn}
            onPress={() => router.push("/donations")}
            accessibilityLabel="New message"
          >
            <Ionicons name="create-outline" size={24} color={C.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.inner}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={C.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={C.primary} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={C.primary} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>Start a conversation by contacting a donor</Text>
            <Pressable style={styles.browseBtn} onPress={() => router.push("/donations")}>
              <Text style={styles.browseBtnTxt}>Browse donations</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, item.blocked && styles.cardMuted]}
                onPress={() =>
                  router.push({
                    pathname: "/chats/[conversationId]",
                    params: { conversationId: item.id },
                  })
                }
              >
                {item.unread > 0 ? <View style={styles.dotLeft} /> : <View style={styles.dotSpacer} />}
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{item.peerName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.peerName} numberOfLines={1}>
                      {item.peerName}
                    </Text>
                    <Text style={styles.time}>{formatConvTime(item.lastMessageAt)}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessageText || "No messages yet"}
                  </Text>
                </View>
                {item.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{item.unread > 9 ? "9+" : item.unread}</Text>
                  </View>
                ) : (
                  <View style={{ width: 8 }} />
                )}
              </Pressable>
            )}
          />
        )}
      </View>

      <PrivateBottomNav active="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  center: { justifyContent: "center", alignItems: "center" },
  muted: { color: C.muted, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: C.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  inner: {
    flex: 1,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  listContent: { paddingBottom: 110, gap: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 10,
    ...cardShadowSoft(),
  },
  cardMuted: { opacity: 0.55 },
  dotLeft: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.badge,
    marginRight: -4,
  },
  dotSpacer: { width: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.tan,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 18, fontWeight: "800", color: C.text },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  peerName: { fontSize: 14, fontWeight: "800", color: C.text, flex: 1 },
  time: { fontSize: 12, color: C.muted },
  preview: { fontSize: 13, color: C.muted },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: C.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  empty: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: C.muted, textAlign: "center", marginTop: 8 },
  browseBtn: {
    marginTop: 20,
    backgroundColor: C.secondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  browseBtnTxt: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});
