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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ROUTES } from "@/lib/app-routes";
import { useAuth } from "@/lib/auth-context";
import { crossAlert } from "@/lib/cross-alert";
import { db } from "@/lib/firebase";
import { createEligibilityReview } from "@/lib/eligibility-reviews";
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

 type UserRow = { 
  id: string; 
  name?: string; 
  email?: string; 
  role?: UserRole; 
  createdAt?: any; 
  disabled?: boolean;
  committeeName?: string;
  committeeDescription?: string;
  committeePhone?: string;
  committeeEmail?: string;
  committeeCity?: string;
  verified?: boolean;
  verifiedAt?: any;
};

type ItemRow = {
  id: string;
  title?: string;
  status?: string;
  userId?: string;
  ownerId?: string;
  ownerName?: string;
  donorName?: string;
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
  const [committeeModalVisible, setCommitteeModalVisible] = useState(false);
  const [selectedCommitteeUid, setSelectedCommitteeUid] = useState("");
  const [committeeName, setCommitteeName] = useState("");
  const [committeeDescription, setCommitteeDescription] = useState("");
  const [committeePhone, setCommitteePhone] = useState("");
  const [committeeEmail, setCommitteeEmail] = useState("");
  const [committeeCity, setCommitteeCity] = useState("");
  const [viewCommittee, setViewCommittee] = useState<UserRow | null>(null);

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
  if (role === "committee") {
    setSelectedCommitteeUid(uid);
    setCommitteeName("");
    setCommitteeDescription("");
    setCommitteePhone("");
    setCommitteeEmail("");
    setCommitteeCity("");
    setCommitteeModalVisible(true);
    return;
  }
  try {
    await updateDoc(doc(db, "users", uid), { role });
  } catch (e: unknown) {
    crossAlert("Error", e instanceof Error ? e.message : "Failed");
  }
};

const saveCommitteeRole = async () => {
  if (!committeeName.trim()) {
    crossAlert("Error", "Committee name is required.");
    return;
  }
  try {
    const { committeeIdFromCity } = await import("@/lib/committees");
    const resolvedCommitteeId = committeeCity.trim()
      ? committeeIdFromCity(committeeCity.trim())
      : DEFAULT_COMMITTEE_ID;

    const patch: Record<string, unknown> = {
      role: "committee",
      committeeId: resolvedCommitteeId,
      committeeName: committeeName.trim(),
      committeeDescription: committeeDescription.trim() || null,
      committeePhone: committeePhone.trim() || null,
      committeeEmail: committeeEmail.trim() || null,
      committeeCity: committeeCity.trim() || null,
      verified: true,
      verifiedAt: serverTimestamp(),
    };
    await setDoc(
      doc(db, "committeeMembers", `${selectedCommitteeUid}_${resolvedCommitteeId}`),
      {
        userId: selectedCommitteeUid,
        committeeId: resolvedCommitteeId,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await updateDoc(doc(db, "users", selectedCommitteeUid), patch);
    setCommitteeModalVisible(false);
    crossAlert("Done", "Committee member assigned successfully.");
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

  const deleteItem = async (itemId: string) => {
  crossAlert("Delete Item", "Are you sure you want to delete this item?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        try {
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "items", itemId));
          crossAlert("Done", "Item deleted.");
        } catch (e: unknown) {
          crossAlert("Error", e instanceof Error ? e.message : "Failed");
        }
      },
    },
  ]);
};

const deleteUser = async (uid: string) => {
  crossAlert("Disable User", "This will mark the user as disabled.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Disable",
      style: "destructive",
      onPress: async () => {
        try {
          await updateDoc(doc(db, "users", uid), { disabled: true });
          crossAlert("Done", "User disabled.");
        } catch (e: unknown) {
          crossAlert("Error", e instanceof Error ? e.message : "Failed");
        }
      },
    },
  ]);
};

const toggleUserDisabled = async (uid: string, currentlyDisabled: boolean) => {
  crossAlert(
    currentlyDisabled ? "Enable User" : "Disable User",
    currentlyDisabled ? "Re-enable this user?" : "This will block the user.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: currentlyDisabled ? "Enable" : "Disable",
        style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "users", uid), { disabled: !currentlyDisabled });
            crossAlert("Done", currentlyDisabled ? "User enabled." : "User disabled.");
          } catch (e: unknown) {
            crossAlert("Error", e instanceof Error ? e.message : "Failed");
          }
        },
      },
    ],
  );
};

const resolveReport = async (reportId: string, action: "resolved" | "dismissed") => {
  try {
    await updateDoc(doc(db, "conversation_reports", reportId), {
      status: action,
      resolvedAt: serverTimestamp(),
    });
    crossAlert("Done", `Report ${action}.`);
  } catch (e: unknown) {
    crossAlert("Error", e instanceof Error ? e.message : "Failed");
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
        <View style={{ width: 22 }} />
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
  Owner: {userMap[item.ownerId ?? ""] || item.donorName || item.ownerName || "—"}
</Text>
                  <Text style={styles.mutedSmall}>Created: {formatDate(item.createdAt)}</Text>
                  {item.description && (
                    <Text style={styles.mutedSmall} numberOfLines={2}>{item.description}</Text>
                  )}
                  <Pressable
  style={[styles.assignBtn, { backgroundColor: C.danger }]}
  onPress={() => void deleteItem(item.id)}
>
  <Ionicons name="trash-outline" size={14} color="#fff" />
  <Text style={styles.assignBtnText}>Delete Item</Text>
</Pressable>
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
                {user.role === "committee" && user.committeeName && (
  <Pressable
    style={[styles.assignBtn, { backgroundColor: "#1976D2", marginTop: 4 }]}
    onPress={() => {
  setViewCommittee(user);
}}
  >
    <Ionicons name="information-circle-outline" size={14} color="#fff" />
    <Text style={styles.assignBtnText}>View Committee Info</Text>
  </Pressable>
)}
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
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
  <Pressable
    style={[styles.assignBtn, { backgroundColor: user.disabled ? C.green : C.danger }]}
    onPress={() => void toggleUserDisabled(user.id, !!user.disabled)}
  >
    <Ionicons name={user.disabled ? "checkmark-outline" : "ban-outline"} size={14} color="#fff" />
    <Text style={styles.assignBtnText}>{user.disabled ? "Enable User" : "Disable User"}</Text>
  </Pressable>
</View>
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
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
  <Pressable
    style={[styles.assignBtn, { backgroundColor: C.green }]}
    onPress={() => void resolveReport(report.id, "resolved")}
  >
    <Ionicons name="checkmark-outline" size={14} color="#fff" />
    <Text style={styles.assignBtnText}>Resolve</Text>
  </Pressable>
  <Pressable
    style={[styles.assignBtn, { backgroundColor: C.muted }]}
    onPress={() => void resolveReport(report.id, "dismissed")}
  >
    <Ionicons name="close-outline" size={14} color="#fff" />
    <Text style={styles.assignBtnText}>Dismiss</Text>
  </Pressable>
</View>
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
        <Modal visible={committeeModalVisible} transparent animationType="slide">
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Committee Information</Text>

      <TextInput
        style={styles.modalInput}
        placeholder="Committee Name *"
        placeholderTextColor={C.muted}
        value={committeeName}
        onChangeText={setCommitteeName}
      />
      <TextInput
        style={styles.modalInput}
        placeholder="Description"
        placeholderTextColor={C.muted}
        value={committeeDescription}
        onChangeText={setCommitteeDescription}
        multiline
      />
      <TextInput
        style={styles.modalInput}
        placeholder="Phone"
        placeholderTextColor={C.muted}
        value={committeePhone}
        onChangeText={setCommitteePhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.modalInput}
        placeholder="Email"
        placeholderTextColor={C.muted}
        value={committeeEmail}
        onChangeText={setCommitteeEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.modalInput}
        placeholder="City"
        placeholderTextColor={C.muted}
        value={committeeCity}
        onChangeText={setCommitteeCity}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          style={[styles.assignBtn, { flex: 1, backgroundColor: C.muted, alignSelf: "auto" }]}
          onPress={() => setCommitteeModalVisible(false)}
        >
          <Text style={styles.assignBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.assignBtn, { flex: 2, backgroundColor: C.primary, alignSelf: "auto" }]}
          onPress={() => void saveCommitteeRole()}
        >
          <Text style={styles.assignBtnText}>Save & Assign</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
        <View style={{ height: 40 }} />
      </ScrollView>
      <Modal visible={!!viewCommittee} transparent animationType="fade">
  <Pressable style={styles.modalBackdrop} onPress={() => setViewCommittee(null)}>
    <Pressable style={styles.modalCard} onPress={() => {}}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="people" size={24} color={C.primary} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, flex: 1 }}>
          {viewCommittee?.committeeName ?? "Committee"}
          {viewCommittee?.verified && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Ionicons name="checkmark-circle" size={14} color="#1976D2" />
              <Text style={{ fontSize: 12, color: "#1976D2", fontWeight: "700" }}>Verified</Text>
            </View>
          )}
        </Text>
      </View>

      {[
        { icon: "document-text-outline" as const, label: "Description", value: viewCommittee?.committeeDescription },
        { icon: "call-outline" as const, label: "Phone", value: viewCommittee?.committeePhone },
        { icon: "mail-outline" as const, label: "Email", value: viewCommittee?.committeeEmail },
        { icon: "location-outline" as const, label: "City", value: viewCommittee?.committeeCity },
        { icon: "person-outline" as const, label: "Manager", value: viewCommittee?.name },
      ].map((row) => row.value ? (
        <View key={row.label} style={{ flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
          <Ionicons name={row.icon} size={18} color={C.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.muted, fontWeight: "600" }}>{row.label}</Text>
            <Text style={{ fontSize: 14, color: C.text, fontWeight: "600" }}>{row.value}</Text>
          </View>
        </View>
      ) : null)}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: viewCommittee?.verified ? "#E53935" : "#2E7D32", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
          onPress={async () => {
            if (!viewCommittee) return;
            await updateDoc(doc(db, "users", viewCommittee.id), {
              verified: !viewCommittee.verified,
              verifiedAt: serverTimestamp(),
            });
            setViewCommittee({ ...viewCommittee, verified: !viewCommittee.verified });
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {viewCommittee?.verified ? "Remove Verification" : "✓ Verify Committee"}
          </Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
          onPress={() => setViewCommittee(null)}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Close</Text>
        </Pressable>
      </View>
    </Pressable>
  </Pressable>
</Modal>
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
  modalBackdrop: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "flex-end",
},
modalCard: {
  backgroundColor: C.card,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 22,
  paddingBottom: Platform.OS === "ios" ? 36 : 22,
  gap: 10,
},
modalTitle: {
  fontSize: 16,
  fontWeight: "800",
  color: C.text,
  marginBottom: 6,
},
modalInput: {
  backgroundColor: "#F0F0F0",
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: C.text,
},
});
