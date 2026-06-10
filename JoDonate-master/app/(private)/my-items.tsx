import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { getAuthUser } from "@/lib/auth-user";
import { notifyDonationCompleted } from "@/lib/donation-lifecycle";
import { createInAppNotification } from "@/lib/notifications";
import { db } from "@/lib/firebase";
import { useLocale } from "@/lib/locale-context";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";
import { PrivateBottomNav } from "@/components/private-bottom-nav";

type ItemDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  status?: string;
  imageUrl?: string;
  ownerId: string;
  createdAt?: unknown;
  contactNumber?: string;
};

type RecipientInfo = {
  name: string;
  email: string;
};

export default function MyItemsScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const user = getAuthUser();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [recipients, setRecipients] = useState<Record<string, RecipientInfo>>({});

  const fetchRecipients = useCallback(async (itemsList: ItemDoc[]) => {
    const accepted = itemsList.filter(
      (it) => it.status === "accepted" || it.status === "donated",
    );
    if (accepted.length === 0) return;

    const newRecipients: Record<string, RecipientInfo> = {};

    await Promise.all(
      accepted.map(async (item) => {
        try {
          const reqQ = query(
            collection(db, "requests"),
            where("itemId", "==", item.id),
            where("status", "==", "approved"),
          );
          const reqSnap = await getDocs(reqQ);
          if (reqSnap.empty) return;

          const reqData = reqSnap.docs[0].data() as {
            requesterId?: string;
            requesterName?: string;
          };
          if (!reqData.requesterId) return;

          const userSnap = await getDoc(doc(db, "users", reqData.requesterId));
          if (userSnap.exists()) {
            const ud = userSnap.data() as { name?: string; email?: string };
            newRecipients[item.id] = {
              name: ud.name ?? reqData.requesterName ?? "User",
              email: ud.email ?? "",
            };
          } else {
            newRecipients[item.id] = {
              name: reqData.requesterName ?? "User",
              email: "",
            };
          }
        } catch {
          // skip
        }
      }),
    );

    setRecipients((prev) => ({ ...prev, ...newRecipients }));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }

    const q = query(
      collection(db, "items"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const data: ItemDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ItemDoc, "id">),
        }));
        setItems(data);
        setLoading(false);
        await fetchRecipients(data);
      },
      (err) => {
        console.warn("MyItems query error:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, [user, fetchRecipients]);

  const markDonated = async (itemId: string) => {
    if (!user) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      Alert.alert("Error", "Item not found.");
      return;
    }
    try {
      await updateDoc(doc(db, "items", itemId), { status: "donated" });
      await notifyDonationCompleted({
        itemId,
        ownerId: user.uid,
        itemTitle: item.title,
      });
      Alert.alert("Done", "Item marked as donated. Notifications were sent.");
    } catch {
      Alert.alert("Error", "Failed to update item.");
    }
  };

  const deleteItem = async (item: ItemDoc) => {
  Alert.alert("Delete item", "Are you sure you want to delete this item?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        try {
          await deleteDoc(doc(db, "items", item.id));

          Alert.alert("Deleted", "Item deleted successfully.");
        } catch {
          Alert.alert("Error", "Failed to delete item.");
        }
      },
    },
  ]);
};

  const messageAdmin = async () => {
    if (!user) return;
    try {
      const adminQ = query(
        collection(db, "users"),
        where("role", "==", "admin"),
      );
      const adminSnap = await getDocs(adminQ);
      if (adminSnap.empty) {
        Alert.alert("No admin found", "There is no admin to message currently.");
        return;
      }
      const adminId = adminSnap.docs[0].id;
      const convId = [user.uid, adminId].sort().join("_");

      await createInAppNotification({
        toUserId: adminId,
        title: "Message from donor",
        body: `Donor ${user.email ?? "user"} wants to contact admin.`,
        type: "donor_contact_admin",
        fromUserId: user.uid,
      });

      router.push({
        pathname: "/chats/[conversationId]",
        params: { conversationId: convId },
      });
    } catch {
      Alert.alert("Error", "Could not contact admin.");
    }
  };

  const isAccepted = (s?: string) => {
    const st = (s ?? "").toLowerCase();
    return st === "accepted" || st === "donated";
  };

  const statusColor = (s?: string) => {
    switch ((s ?? "available").toLowerCase()) {
      case "available":
        return "#4CAF50";
      case "requested":
        return "#FF9800";
      case "accepted":
        return "#2196F3";
      case "donated":
        return "#9C27B0";
      default:
        return "#888";
    }
  };

  const statusIcon = (s?: string): keyof typeof Ionicons.glyphMap => {
    switch ((s ?? "available").toLowerCase()) {
      case "available":
        return "checkmark-circle";
      case "requested":
        return "time";
      case "accepted":
        return "hand-left";
      case "donated":
        return "gift";
      default:
        return "ellipse";
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router, "/profile")} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("myAds")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{items.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#4CAF50" }]}>
            {items.filter((i) => i.status === "available").length}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#FF9800" }]}>
            {items.filter((i) => i.status === "requested").length}
          </Text>
          <Text style={styles.statLabel}>Requested</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: "#9C27B0" }]}>
            {items.filter((i) => i.status === "accepted" || i.status === "donated").length}
          </Text>
          <Text style={styles.statLabel}>Given</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.primary} />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="gift-outline" size={56} color={C.muted} />
          <Text style={styles.emptyTitle}>No donations yet</Text>
          <Text style={styles.emptySub}>Start sharing by adding your first donation</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push("/add-item")}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addBtnTxt}>Add Donation</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const recipient = recipients[item.id];
            const accepted = isAccepted(item.status);

            return (
              <View style={[styles.card, cardShadowSoft()]}>
                <Pressable
                  style={styles.cardRow}
                  onPress={() =>
                    router.push({ pathname: "/item/[id]", params: { id: item.id } })
                  }
                >
                  <View style={styles.thumb}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
                    ) : (
                      <Ionicons name="image-outline" size={22} color={C.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.category}
                    </Text>
                    <View style={styles.statusRow}>
                      <Ionicons
                        name={statusIcon(item.status)}
                        size={14}
                        color={statusColor(item.status)}
                      />
                      <Text style={[styles.statusTxt, { color: statusColor(item.status) }]}>
                        {(item.status ?? "available").charAt(0).toUpperCase() +
                          (item.status ?? "available").slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </Pressable>

                {accepted && recipient ? (
                  <View style={styles.recipientBox}>
                    <Ionicons name="person-circle-outline" size={20} color={C.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientLabel}>Recipient</Text>
                      <Text style={styles.recipientName}>{recipient.name}</Text>
                      {recipient.email ? (
                        <Text style={styles.recipientEmail}>{recipient.email}</Text>
                      ) : null}
                    </View>
                    {item.status === "donated" ? (
                      <View style={styles.donatedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={styles.donatedBadgeTxt}>Donated</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.actionNeutral]}
                    onPress={() =>
                      router.push({ pathname: "/edit-item/[id]", params: { id: item.id } })
                    }
                  >
                    <Ionicons name="create-outline" size={14} color={C.primary} />
                    <Text style={[styles.actionText, { color: C.primary }]}>Edit</Text>
                  </Pressable>

                  {item.status === "accepted" ? (
                    <Pressable
                      style={[styles.actionBtn, styles.actionSuccess]}
                      onPress={() => markDonated(item.id)}
                    >
                      <Ionicons name="gift-outline" size={14} color="#fff" />
                      <Text style={styles.actionText}>Mark Donated</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[styles.actionBtn, styles.actionDanger]}
                    onPress={() => deleteItem(item)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#fff" />
                    <Text style={styles.actionText}>Delete</Text>
                  </Pressable>
                </View>

                {item.status === "requested" ? (
                  <Pressable
                    style={styles.viewRequestsBtn}
                    onPress={() => router.push("/my-requests")}
                  >
                    <Ionicons name="eye-outline" size={16} color={C.primary} />
                    <Text style={styles.viewRequestsTxt}>View requests for this item</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
      <PrivateBottomNav active="profile" />
    </View>
  );
}

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#fff",
  text: "#2C2C2A",
  muted: "#888",
  green: "#2E7D32",
  danger: "#E24B4A",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  header: {
    backgroundColor: C.primary,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  statNum: {
    fontSize: 20,
    fontWeight: "800",
    color: C.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  addBtnTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
  },
  title: {
    color: C.text,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 2,
  },
  sub: {
    color: C.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  statusTxt: {
    fontSize: 12,
    fontWeight: "700",
  },
  recipientBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    padding: 10,
  },
  recipientLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
  },
  recipientEmail: {
    fontSize: 11,
    color: C.muted,
  },
  donatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#9C27B0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  donatedBadgeTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 38,
    borderRadius: 10,
  },
  actionNeutral: {
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  actionSuccess: {
    backgroundColor: C.green,
  },
  actionDanger: {
    backgroundColor: C.danger,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  viewRequestsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0E0E0",
  },
  viewRequestsTxt: {
    color: C.primary,
    fontWeight: "700",
    fontSize: 12,
  },
});