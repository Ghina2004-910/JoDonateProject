import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import { getAuthUser } from "@/lib/auth-user";
import { crossAlert } from "@/lib/cross-alert";
import { DEFAULT_COMMITTEE_ID } from "@/lib/committees";
import { reviewEligibility, type EligibilityStatus } from "@/lib/eligibility-reviews";
import { db } from "@/lib/firebase";
import { useUserProfile } from "@/lib/user-profile-context";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#fff",
  text: "#2C2C2A",
  muted: "#888",
  green: "#2E7D32",
  danger: "#E24B4A",
};

type ReviewDoc = {
  id: string;
  requestId?: string;
  itemId?: string;
  requesterId?: string;
  itemOwnerId?: string;
  requesterName?: string;
  committeeId?: string;
  status: EligibilityStatus;
  createdAt?: { toDate?: () => Date } | null;
  reviewerId?: string;
  notes?: string;
  reviewedAt?: { toDate?: () => Date } | null;
};

type UserInfo = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  phone?: string;
};

type ItemInfo = {
  title?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  city?: string;
};

type Tab = "pending" | "reviewed"| "donations";

export default function CommitteeReviewsScreen() {
  const router = useRouter();
  const { signOutApp } = useAuth();
  const { isCommittee, isAdmin, committeeId, loading: profileLoading } = useUserProfile();
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserInfo>>({});
  const [itemsMap, setItemsMap] = useState<Record<string, ItemInfo>>({});
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [deciding, setDeciding] = useState<string | null>(null);
  const [committeeItems, setCommitteeItems] = useState<{id: string; title?: string; imageUrl?: string; city?: string; category?: string; donorName?: string; ownerId?: string}[]>([]);
  const fetchedUsers = useRef(new Set<string>());
  const fetchedItems = useRef(new Set<string>());

  const canAccess = isCommittee || isAdmin;

  useEffect(() => {
    if (profileLoading || !canAccess) return;
    const q = isAdmin
      ? query(collection(db, "eligibilityReviews"), orderBy("createdAt", "desc"))
      : query(
          collection(db, "eligibilityReviews"),
          where("committeeId", "==", committeeId || DEFAULT_COMMITTEE_ID),
          orderBy("createdAt", "desc"),
        );
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReviewDoc, "id">),
      }));
      setReviews(docs);
    });
  }, [canAccess, profileLoading, isAdmin, committeeId]);

  useEffect(() => {
    if (reviews.length === 0) return;

    const userIds = new Set<string>();
    const itemIds = new Set<string>();

    reviews.forEach((r) => {
      if (r.requesterId) userIds.add(r.requesterId);
      if (r.itemOwnerId) userIds.add(r.itemOwnerId);
      if (r.itemId) itemIds.add(r.itemId);
    });

    userIds.forEach((uid) => {
      if (fetchedUsers.current.has(uid)) return;
      fetchedUsers.current.add(uid);
      void getDoc(doc(db, "users", uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUsersMap((prev) => ({
            ...prev,
            [uid]: {
              name: data.name,
              email: data.email,
              avatarUrl: data.avatarUrl,
              phone: data.phone,
            },
          }));
        }
      });
    });

    itemIds.forEach((iid) => {
      if (fetchedItems.current.has(iid)) return;
      fetchedItems.current.add(iid);
      void getDoc(doc(db, "items", iid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setItemsMap((prev) => ({
            ...prev,
            [iid]: {
              title: data.title,
              category: data.category,
              description: data.description,
              imageUrl: data.imageUrl,
              city: data.city,
            },
          }));
        }
      });
    });
  }, [reviews]);

  useEffect(() => {
    if (profileLoading) return;
    if (!canAccess) {
      crossAlert("Access denied", "Committee members only.", [
        { text: "OK", onPress: () => router.replace("/(private)") },
      ]);
    }
  }, [profileLoading, canAccess, router]);

  useEffect(() => {
  if (!canAccess) return;
  const user = getAuthUser();
  if (!user) return;
  const q = isAdmin
    ? query(collection(db, "items"), where("donationMode", "==", "committee"))
    : query(
        collection(db, "items"),
        where("donationMode", "==", "committee"),
        where("committeeUid", "==", user.uid),
        orderBy("createdAt", "desc"),
      );
  return onSnapshot(q, async (snap) => {
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as { title?: string; imageUrl?: string; city?: string; category?: string; ownerId?: string };
        let donorName = "";
        if (data.ownerId) {
          const userSnap = await getDoc(doc(db, "users", data.ownerId));
          if (userSnap.exists()) {
            donorName = (userSnap.data() as { name?: string }).name ?? "";
          }
        }
        return { id: d.id, ...data, donorName };
      })
    );
    setCommitteeItems(items);
  });
}, [canAccess, isAdmin]);

  const pendingReviews = useMemo(
    () => reviews.filter((r) => r.status === "pending"),
    [reviews],
  );
  const reviewedReviews = useMemo(
    () => reviews.filter((r) => r.status !== "pending"),
    [reviews],
  );

  const stats = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    reviews.forEach((r) => {
      if (r.status === "pending") pending++;
      else if (r.status === "approved") approved++;
      else if (r.status === "rejected") rejected++;
    });
    return { pending, approved, rejected };
  }, [reviews]);

  const decide = useCallback(async (id: string, status: EligibilityStatus) => {
    const me = getAuthUser()?.uid;
    if (!me) return;
    setDeciding(id);
    try {
      await reviewEligibility(id, status, me, notes[id]);
      crossAlert("Done", `Marked as ${status}.`);
    } catch (e: unknown) {
      crossAlert("Error", e instanceof Error ? e.message : "Failed");
    } finally {
      setDeciding(null);
    }
  }, [notes]);

  const handleLogout = useCallback(() => {
    crossAlert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          void signOutApp().then(() => {
            router.replace("/(onboarding)" as Href);
          });
        },
      },
    ]);
  }, [signOutApp, router]);

  const formatDate = (ts: { toDate?: () => Date } | null | undefined) => {
    if (!ts || !ts.toDate) return "—";
    const d = ts.toDate();
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (profileLoading || !canAccess) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>Loading…</Text>
      </View>
    );
  }

  const currentData = activeTab === "pending" ? pendingReviews : activeTab === "reviewed" ? reviewedReviews : [];

  const renderReviewCard = ({ item }: { item: ReviewDoc }) => {
    const requester = item.requesterId ? usersMap[item.requesterId] : null;
    const donor = item.itemOwnerId ? usersMap[item.itemOwnerId] : null;
    const itemInfo = item.itemId ? itemsMap[item.itemId] : null;
    const isPending = item.status === "pending";
    const isProcessing = deciding === item.id;

    return (
      <View style={styles.card}>
        {/* Item Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="gift-outline" size={16} color={C.primary} />
          <Text style={styles.sectionTitle}>Donation Item</Text>
        </View>
        {itemInfo?.imageUrl ? (
          <Image source={{ uri: itemInfo.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={C.muted} />
          </View>
        )}
        <Text style={styles.itemTitle}>{itemInfo?.title ?? "Loading..."}</Text>
        {itemInfo?.category && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemInfo.category}</Text>
          </View>
        )}
        {itemInfo?.description && (
          <Text style={styles.descText} numberOfLines={3}>
            {itemInfo.description}
          </Text>
        )}
        {itemInfo?.city && (
          <View style={styles.inlineRow}>
            <Ionicons name="location-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>{itemInfo.city}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Requester Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={16} color={C.primary} />
          <Text style={styles.sectionTitle}>Requester</Text>
        </View>
        <Text style={styles.personName}>
          {requester?.name ?? item.requesterName ?? "Loading..."}
        </Text>
        {requester?.email && (
          <View style={styles.inlineRow}>
            <Ionicons name="mail-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>{requester.email}</Text>
          </View>
        )}
        {requester?.phone && (
          <View style={styles.inlineRow}>
            <Ionicons name="call-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>{requester.phone}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Donor Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-outline" size={16} color={C.primary} />
          <Text style={styles.sectionTitle}>Donor</Text>
        </View>
        <Text style={styles.personName}>{donor?.name ?? "Loading..."}</Text>
        {donor?.email && (
          <View style={styles.inlineRow}>
            <Ionicons name="mail-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>{donor.email}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Request Date */}
        <View style={styles.inlineRow}>
          <Ionicons name="calendar-outline" size={13} color={C.muted} />
          <Text style={styles.mutedText}>
            Requested: {formatDate(item.createdAt)}
          </Text>
        </View>

        {/* Pending: show notes + buttons */}
        {isPending && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Add reviewer notes (optional)..."
              placeholderTextColor={C.muted}
              value={notes[item.id] ?? ""}
              onChangeText={(t) => setNotes((p) => ({ ...p, [item.id]: t }))}
              multiline
            />
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.btn, styles.approveBtn]}
                onPress={() => void decide(item.id, "approved")}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.btnText}>Approve</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => void decide(item.id, "rejected")}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.btnText}>Reject</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {/* Reviewed: show decision info */}
        {!isPending && (
          <View style={styles.decisionBox}>
            <View style={styles.inlineRow}>
              <Ionicons
                name={item.status === "approved" ? "checkmark-circle" : "close-circle"}
                size={18}
                color={item.status === "approved" ? C.green : C.danger}
              />
              <Text
                style={[
                  styles.decisionText,
                  { color: item.status === "approved" ? C.green : C.danger },
                ]}
              >
                {item.status === "approved" ? "Approved" : "Rejected"}
              </Text>
            </View>
            {item.notes && (
              <Text style={styles.notesText}>Notes: {item.notes}</Text>
            )}
            {item.reviewedAt && (
              <Text style={styles.mutedText}>
                Reviewed: {formatDate(item.reviewedAt)}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/(private)/committee-settings")} hitSlop={12}>
  <Ionicons name="settings-outline" size={22} color="#fff" />
</Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Committee Reviews</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? "All committees" : `Committee: ${committeeId || DEFAULT_COMMITTEE_ID}`}
          </Text>
        </View>
        <Pressable onPress={handleLogout} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: C.green }]}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: C.danger }]}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
  <Pressable
    style={[styles.tab, activeTab === "pending" && styles.activeTab]}
    onPress={() => setActiveTab("pending")}
  >
    <Text style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}>
      Pending ({stats.pending})
    </Text>
  </Pressable>
  <Pressable
    style={[styles.tab, activeTab === "reviewed" && styles.activeTab]}
    onPress={() => setActiveTab("reviewed")}
  >
    <Text style={[styles.tabText, activeTab === "reviewed" && styles.activeTabText]}>
      Reviewed ({stats.approved + stats.rejected})
    </Text>
  </Pressable>
  <Pressable
    style={[styles.tab, activeTab === "donations" && styles.activeTab]}
    onPress={() => setActiveTab("donations")}
  >
    <Text style={[styles.tabText, activeTab === "donations" && styles.activeTabText]}>
      Donations ({committeeItems.length})
    </Text>
  </Pressable>
</View>

{activeTab === "donations" && (
  <FlatList
    data={committeeItems}
    keyExtractor={(r) => r.id}
    contentContainerStyle={styles.listContent}
    ListEmptyComponent={
      <View style={styles.emptyContainer}>
        <Ionicons name="gift-outline" size={48} color={C.muted} />
        <Text style={styles.emptyText}>No items assigned to your committee</Text>
      </View>
    }
    renderItem={({ item }) => (
      <View style={styles.card}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={C.muted} />
          </View>
        )}
        <Text style={styles.itemTitle}>{item.title ?? "—"}</Text>
        {item.category && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
        )}
        {item.city && (
          <View style={styles.inlineRow}>
            <Ionicons name="location-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>{item.city}</Text>
          </View>
        )}
        {item.donorName && (
          <View style={styles.inlineRow}>
            <Ionicons name="person-outline" size={13} color={C.muted} />
            <Text style={styles.mutedText}>Donor: {item.donorName}</Text>
          </View>
        )}
        <View style={{ flexDirection: "column", gap: 8, marginTop: 12 }}>
  <View style={{ flexDirection: "row", gap: 8 }}>
    <Pressable
      style={[styles.btn, { backgroundColor: "#1976D2", flex: 0, paddingHorizontal: 30 }]}
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id, committeeView: "true" } })}
    >
      <Ionicons name="eye-outline" size={16} color="#fff" />
      <Text style={styles.btnText}>View Item</Text>
    </Pressable>
    <Pressable
      style={[styles.btn, { backgroundColor: C.primary, flex: 0, paddingHorizontal: 25 }]}
      onPress={() => router.push({
        pathname: "/(private)/committee-item-requests/[itemId]" as any,
        params: { itemId: item.id },
      })}
    >
      <Ionicons name="people-outline" size={16} color="#fff" />
      <Text style={styles.btnText}>View Requests</Text>
    </Pressable>
  </View>
  <Pressable
    style={[styles.btn, { backgroundColor: C.green, flex: 0, paddingHorizontal: 25 }]}
    onPress={async () => {
      const { doc: fsDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
      await updateDoc(fsDoc(db, "items", item.id), {
        status: "donated",
        distributedAt: serverTimestamp(),
      });
      Alert.alert("Done", "Item marked as distributed.");
    }}
  >
    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
    <Text style={styles.btnText}>Mark as Distributed</Text>
  </Pressable>
</View>
      </View>
    )}
  />
)}


      {/* Review Cards */}
      {activeTab !== "donations" && (
      <FlatList
        data={currentData}
        keyExtractor={(r) => r.id}
        renderItem={renderReviewCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === "pending" ? "checkmark-done-circle-outline" : "archive-outline"}
              size={48}
              color={C.muted}
            />
            <Text style={styles.emptyText}>
              {activeTab === "pending"
                ? "No pending reviews"
                : "No reviewed items yet"}
            </Text>
          </View>
        }
      />
      )}

      {/* Bottom Logout */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={C.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  statsBar: {
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: { alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "800", color: C.text },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "#eee" },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  activeTab: { backgroundColor: C.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: C.muted },
  activeTabText: { color: "#fff" },
  listContent: { padding: 16, gap: 16, paddingBottom: 80 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.primary },
  itemImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f0f0f0",
  },
  imagePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 4 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: `${C.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: C.primary },
  descText: { fontSize: 13, color: C.text, lineHeight: 18, marginBottom: 4 },
  personName: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 2 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  mutedText: { fontSize: 13, color: C.muted },
  divider: {
    height: 1,
    backgroundColor: "#f0ede9",
    marginVertical: 10,
  },
  input: {
    backgroundColor: "#f8f7f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ebe8e4",
    minHeight: 50,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 13,
  },
  approveBtn: { backgroundColor: C.green },
  rejectBtn: { backgroundColor: C.danger },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  decisionBox: {
    backgroundColor: "#f8f7f5",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  decisionText: { fontSize: 14, fontWeight: "700" },
  notesText: { fontSize: 13, color: C.text, fontStyle: "italic" },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: C.muted },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#ebe8e4",
    backgroundColor: C.card,
  },
  logoutText: { fontSize: 14, fontWeight: "600", color: C.danger },
});
