import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ROUTES } from "@/lib/app-routes";
import { useAuth } from "@/lib/auth-context";
import { crossAlert } from "@/lib/cross-alert";
import { db } from "@/lib/firebase";
import { createEligibilityReview } from "@/lib/eligibility-reviews";
import { safeGoBack } from "@/lib/navigation";
import { DEFAULT_COMMITTEE_ID } from "@/lib/committees";
import { type UserRole } from "@/lib/roles";
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

type UserRow = { id: string; name?: string; email?: string; role?: UserRole; createdAt?: any };

type ItemRow = {
  id: string;
  title?: string;
  status?: string;
  userId?: string;
  ownerName?: string;
  createdAt?: any;
  category?: string;
  description?: string;
};

type RequestRow = {
  id: string;
  itemId?: string;
  itemOwnerId?: string;
  requesterId?: string;
  requesterName?: string;
  status?: string;
  createdAt?: any;
  eligibilityStatus?: string;
  itemTitle?: string;
};

type ReportRow = {
  id: string;
  reporterId?: string;
  reporterName?: string;
  reportedUserId?: string;
  reason?: string;
  conversationId?: string;
  createdAt?: any;
  status?: string;
};

type DonationTab = "all" | "available" | "requested" | "accepted" | "donated";

const TAB_OPTIONS: { key: DonationTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "donated", label: "Donated" },
];

function formatDate(ts: any): string {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? "unknown").toLowerCase();
  let bg = C.muted;
  if (s === "available") bg = C.green;
  else if (s === "requested" || s === "pending") bg = "#E8A317";
  else if (s === "accepted" || s === "approved") bg = "#1976D2";
  else if (s === "donated" || s === "completed") bg = C.primary;
  else if (s === "rejected" || s === "denied") bg = C.danger;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{status ?? "unknown"}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, icon, count }: { title: string; icon: keyof typeof Ionicons.glyphMap; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={C.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const { signOutApp } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [activeTab, setActiveTab] = useState<DonationTab>("all");
  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({
    stats: true,
    donations: true,
    requests: true,
    users: true,
    reports: true,
  });

  useEffect(() => {
    if (profileLoading || !isAdmin) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(collection(db, "users"), (snap) => {
        setUsers(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })),
        );
      }),
    );

    unsubs.push(
      onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc")), (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ItemRow, "id">) })),
        );
      }),
    );

    unsubs.push(
      onSnapshot(query(collection(db, "requests"), orderBy("createdAt", "desc")), (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestRow, "id">) })),
        );
      }),
    );

    unsubs.push(
      onSnapshot(collection(db, "conversation_reports"), (snap) => {
        setReports(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRow, "id">) })),
        );
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [isAdmin, profileLoading]);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin) {
      crossAlert("Access denied", "Admin only.", [
        { text: "OK", onPress: () => router.replace(ROUTES.home) },
      ]);
    }
  }, [profileLoading, isAdmin, router]);

  const filteredItems = useMemo(() => {
    if (activeTab === "all") return items;
    return items.filter((i) => (i.status ?? "").toLowerCase() === activeTab);
  }, [items, activeTab]);

  const stats = useMemo(() => {
    const activeReqs = requests.filter((r) => r.status === "pending" || r.status === "requested");
    const approvedReqs = requests.filter((r) => r.status === "approved" || r.status === "accepted");
    return {
      totalUsers: users.length,
      totalDonations: items.length,
      activeRequests: activeReqs.length,
      approvedRequests: approvedReqs.length,
    };
  }, [users, items, requests]);

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { map[u.id] = u.name || u.email || u.id.slice(0, 8); });
    return map;
  }, [users]);

  const ensureDefaultCommittee = async () => {
    await setDoc(
      doc(db, "committees", DEFAULT_COMMITTEE_ID),
      { name: "Default committee", city: "Jordan", active: true },
      { merge: true },
    );
    crossAlert("Done", "Default committee ready.");
  };

  const setRole = async (uid: string, role: UserRole) => {
    try {
      const patch: Record<string, unknown> = { role };
      if (role === "committee") {
        patch.committeeId = DEFAULT_COMMITTEE_ID;
        await setDoc(
          doc(db, "committeeMembers", `${uid}_${DEFAULT_COMMITTEE_ID}`),
          {
            userId: uid,
            committeeId: DEFAULT_COMMITTEE_ID,
            active: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      await updateDoc(doc(db, "users", uid), patch);
    } catch (e: unknown) {
      crossAlert("Error", e instanceof Error ? e.message : "Failed");
    }
  };

  const assignToCommittee = async (req: RequestRow) => {
    if (!req.requesterId || !req.itemId || !req.itemOwnerId) {
      crossAlert("Error", "Missing request data.");
      return;
    }
    try {
      const existingQ = query(
        collection(db, "eligibilityReviews"),
        where("requestId", "==", req.id),
      );
      const existing = await getDocs(existingQ);
      if (!existing.empty) {
        crossAlert("Already assigned", "This request already has a committee review.");
        return;
      }

      await createEligibilityReview({
        requestId: req.id,
        itemId: req.itemId,
        requesterId: req.requesterId,
        itemOwnerId: req.itemOwnerId,
        requesterName: req.requesterName ?? "User",
        committeeId: DEFAULT_COMMITTEE_ID,
      });
      crossAlert("Assigned", "Request sent to committee for review.");
    } catch (e: unknown) {
      crossAlert("Error", e instanceof Error ? e.message : "Failed to assign.");
    }
  };

  const handleLogout = () => {
    crossAlert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void signOutApp().then(() => {
            router.replace("/(onboarding)" as Href);
          });
        },
      },
    ]);
  };

  const toggleSection = (key: string) => {
    setExpandedSection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (profileLoading || !isAdmin) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[styles.mutedText, { marginTop: 12 }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router, "/profile")} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Pressable onPress={handleLogout} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* Stats Dashboard */}
        <View style={styles.statsRow}>
          <StatCard icon="people" label="Users" value={stats.totalUsers} color="#1976D2" />
          <StatCard icon="gift" label="Donations" value={stats.totalDonations} color={C.green} />
          <StatCard icon="time" label="Active Req." value={stats.activeRequests} color="#E8A317" />
          <StatCard icon="checkmark-circle" label="Approved" value={stats.approvedRequests} color={C.primary} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable style={styles.actionBtn} onPress={() => void ensureDefaultCommittee()}>
            <Ionicons name="settings-outline" size={18} color={C.primary} />
            <Text style={styles.actionBtnText}>Init Committee</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(ROUTES.committeeReviews)}>
            <Ionicons name="clipboard-outline" size={18} color={C.primary} />
            <Text style={styles.actionBtnText}>Committee Reviews</Text>
          </Pressable>
        </View>

        {/* All Donations Section */}
        <Pressable onPress={() => toggleSection("donations")}>
          <SectionHeader title="All Donations" icon="gift-outline" count={items.length} />
        </Pressable>
        {expandedSection.donations && (
          <View style={styles.sectionBody}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
              {TAB_OPTIONS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredItems.length === 0 ? (
              <Text style={styles.emptyText}>No items found.</Text>
            ) : (
              filteredItems.slice(0, 50).map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title ?? "Untitled Item"}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  {item.category && <Text style={styles.mutedText}>Category: {item.category}</Text>}
                  <Text style={styles.mutedText}>
                    Owner: {item.ownerName || userMap[item.userId ?? ""] || item.userId?.slice(0, 8) || "—"}
                  </Text>
                  <Text style={styles.mutedSmall}>Created: {formatDate(item.createdAt)}</Text>
                  {item.description && (
                    <Text style={styles.mutedSmall} numberOfLines={2}>{item.description}</Text>
                  )}
                </View>
              ))
            )}
            {filteredItems.length > 50 && (
              <Text style={styles.mutedText}>Showing 50 of {filteredItems.length} items</Text>
            )}
          </View>
        )}

        {/* All Requests Section */}
        <Pressable onPress={() => toggleSection("requests")}>
          <SectionHeader title="All Requests" icon="swap-horizontal-outline" count={requests.length} />
        </Pressable>
        {expandedSection.requests && (
          <View style={styles.sectionBody}>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>No requests found.</Text>
            ) : (
              requests.slice(0, 50).map((req) => (
                <View key={req.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {req.itemTitle ?? `Item ${req.itemId?.slice(0, 8) ?? "?"}`}
                    </Text>
                    <StatusBadge status={req.status} />
                  </View>
                  <Text style={styles.mutedText}>
                    Requester: {req.requesterName || userMap[req.requesterId ?? ""] || req.requesterId?.slice(0, 8) || "—"}
                  </Text>
                  {req.eligibilityStatus && (
                    <View style={styles.eligibilityRow}>
                      <Text style={styles.mutedSmall}>Eligibility: </Text>
                      <StatusBadge status={req.eligibilityStatus} />
                    </View>
                  )}
                  <Text style={styles.mutedSmall}>Created: {formatDate(req.createdAt)}</Text>
                  {req.status === "pending" && (
                    <Pressable
                      style={styles.assignBtn}
                      onPress={() => void assignToCommittee(req)}
                    >
                      <Ionicons name="people-outline" size={14} color="#fff" />
                      <Text style={styles.assignBtnText}>Assign to Committee</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
            {requests.length > 50 && (
              <Text style={styles.mutedText}>Showing 50 of {requests.length} requests</Text>
            )}
          </View>
        )}

        {/* User Management Section */}
        <Pressable onPress={() => toggleSection("users")}>
          <SectionHeader title="User Management" icon="people-outline" count={users.length} />
        </Pressable>
        {expandedSection.users && (
          <View style={styles.sectionBody}>
            {users.map((user) => (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.name ?? "User"}</Text>
                <Text style={styles.mutedText}>{user.email ?? user.id}</Text>
                <View style={styles.roleRow}>
                  <Text style={styles.roleLabel}>Role: {user.role ?? "user"}</Text>
                </View>
                <View style={styles.chipRow}>
                  {(["user", "committee", "admin"] as UserRole[]).map((r) => (
                    <Pressable
                      key={r}
                      style={[
                        styles.chip,
                        (user.role ?? "user") === r && styles.chipActive,
                      ]}
                      onPress={() => void setRole(user.id, r)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          (user.role ?? "user") === r && styles.chipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Reports Section */}
        <Pressable onPress={() => toggleSection("reports")}>
          <SectionHeader title="Conversation Reports" icon="flag-outline" count={reports.length} />
        </Pressable>
        {expandedSection.reports && (
          <View style={styles.sectionBody}>
            {reports.length === 0 ? (
              <Text style={styles.emptyText}>No reports filed.</Text>
            ) : (
              reports.map((report) => (
                <View key={report.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      Report #{report.id.slice(0, 8)}
                    </Text>
                    {report.status && <StatusBadge status={report.status} />}
                  </View>
                  <Text style={styles.mutedText}>
                    Reporter: {report.reporterName || userMap[report.reporterId ?? ""] || report.reporterId?.slice(0, 8) || "—"}
                  </Text>
                  {report.reportedUserId && (
                    <Text style={styles.mutedText}>
                      Reported User: {userMap[report.reportedUserId] || report.reportedUserId.slice(0, 8)}
                    </Text>
                  )}
                  {report.reason && (
                    <Text style={styles.reasonText} numberOfLines={3}>{report.reason}</Text>
                  )}
                  <Text style={styles.mutedSmall}>Filed: {formatDate(report.createdAt)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Logout Button */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },

  // Stats
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%" as any,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 24, fontWeight: "800", color: C.text },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.primary + "30",
  },
  actionBtnText: { color: C.primary, fontWeight: "700", fontSize: 13 },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: C.text, flex: 1 },
  countBadge: {
    backgroundColor: C.primary + "20",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: C.primary },
  sectionBody: { gap: 10 },

  // Tabs
  tabBar: { marginBottom: 10, flexGrow: 0 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e0dcd7",
  },
  tabActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: C.muted },
  tabTextActive: { color: "#fff" },

  // Cards
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontWeight: "700", color: C.text, fontSize: 14, flex: 1 },
  mutedText: { color: C.muted, fontSize: 13 },
  mutedSmall: { color: C.muted, fontSize: 11, marginTop: 2 },
  emptyText: { color: C.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 },

  // Badge
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  // User management
  roleRow: { marginTop: 4 },
  roleLabel: { color: C.text, fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: C.primary,
  },
  chipText: { color: C.primary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  // Eligibility
  eligibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  // Reports
  reasonText: {
    color: C.text,
    fontSize: 13,
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 18,
  },

  // Assign
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#00897B",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  assignBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Logout
  logoutBtn: {
    backgroundColor: C.danger,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  logoutText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
