import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/firebase";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  unreadDot: "#2196F3",
};

const MAX_W = 380;

type Notif = {
  id: string;
  toUserId: string;
  fromUserId?: string;
  title: string;
  body: string;
  type: string;
  itemId: string;
  conversationId?: string;
  read: boolean;
  createdAt?: unknown;
};

type UserProfile = { name: string; avatarUrl: string };

type TabKey = "all" | "unread" | "messages" | "donations";

function tabMatches(tab: TabKey, n: Notif): boolean {
  const t = (n.type ?? "").toLowerCase();
  const title = (n.title ?? "").toLowerCase();
  const body = (n.body ?? "").toLowerCase();
  if (tab === "all") return true;
  if (tab === "unread") return !n.read;
  if (tab === "messages") {
    return (
      t.includes("message") ||
      t.includes("chat") ||
      title.includes("message") ||
      body.includes("message")
    );
  }
  return (
    t.includes("donation") ||
    t.includes("request") ||
    t.includes("item") ||
    t.includes("committee") ||
    t.includes("eligibility") ||
    t.includes("donated") ||
    t.includes("completed") ||
    title.includes("donation") ||
    title.includes("request") ||
    title.includes("eligibility") ||
    title.includes("donated")
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [tab, setTab] = useState<TabKey>("all");

  const ensureProfile = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      setProfiles((prev) => {
        if (prev[uid]) return prev;
        if (!snap.exists()) {
          return { ...prev, [uid]: { name: "User", avatarUrl: "" } };
        }
        const data = snap.data() as Record<string, unknown>;
        return {
          ...prev,
          [uid]: {
            name: String(data?.name ?? "User"),
            avatarUrl: String(data?.avatarUrl ?? ""),
          },
        };
      });
    } catch {
    }
  }, []);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      setLoading(false);
      setNotifs([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const data: Notif[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Notif, "id">),
        }));
        setNotifs(data);
        setLoading(false);
        setRefreshing(false);

        const senderIds = Array.from(
          new Set(data.map((n) => n.fromUserId).filter((x): x is string => !!x)),
        );
        await Promise.all(senderIds.map((uid) => ensureProfile(uid)));
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsub;
  }, [ensureProfile]);

  const filtered = useMemo(
    () => notifs.filter((n) => tabMatches(tab, n)),
    [notifs, tab],
  );

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch {
      
    }
  };

  const markAllRead = async () => {
    const user = getAuthUser();
    if (!user) return;
    const unread = notifs.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.slice(0, 400).forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch {
      
    }
  };

  const onPressNotif = async (item: Notif) => {
    await markRead(item.id);
    const t = (item.type ?? "").toLowerCase();
    if (t.includes("committee") || t.includes("eligibility")) {
      router.push("/committee/reviews");
      return;
    }
   if (t.includes("message") || t.includes("chat")) {
  if (item.conversationId) {
    router.push({
      pathname: "/chats/[conversationId]",
      params: { conversationId: item.conversationId },
    });
  } else {
    router.push("/chats");
  }
  return;
}
    if (item.itemId) {
      router.push({ pathname: "/item/[id]", params: { id: item.itemId } });
      return;
    }
    router.push("/donations");
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "messages", label: "Messages" },
    { key: "donations", label: "Donations" },
  ];

  const renderRow = ({ item }: { item: Notif }) => {
    const sender = item.fromUserId ? profiles[item.fromUserId] : undefined;
    const subtitle = sender?.name ? `${sender.name} • ${item.body}` : item.body;

    return (
      <Pressable
        style={[styles.row, cardShadowSoft(), !item.read && styles.rowUnread]}
        onPress={() => onPressNotif(item)}
      >
        {!item.read ? <View style={styles.blueDot} /> : <View style={styles.dotSpacer} />}
        <View style={styles.avatarWrap}>
          {sender?.avatarUrl ? (
            <Image source={{ uri: sender.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.iconCircle}>
              <Ionicons name="notifications-outline" size={18} color={C.primary} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router)} style={styles.hit}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable hitSlop={12} onPress={markAllRead} style={styles.hit}>
          <Text style={styles.markAll}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((x) => (
          <Pressable
            key={x.key}
            onPress={() => setTab(x.key)}
            style={[styles.tabChip, tab === x.key && styles.tabChipOn]}
          >
            <Text style={[styles.tabText, tab === x.key && styles.tabTextOn]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color={C.muted} />
          <Text style={styles.empty}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 400);
              }}
              tintColor={C.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderRow}
        />
      )}
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
  markAll: { fontSize: 12, fontWeight: "700", color: C.primary },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  tabChipOn: {
    backgroundColor: "#EDE5DE",
    borderColor: C.primary,
  },
  tabText: { fontSize: 12, fontWeight: "700", color: C.muted },
  tabTextOn: { color: C.primary },
  listPad: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: C.unreadDot,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.unreadDot,
    marginRight: 2,
  },
  dotSpacer: { width: 10 },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
    fontWeight: "500",
    color: C.muted,
    lineHeight: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  empty: { fontSize: 15, fontWeight: "600", color: C.muted },
});
