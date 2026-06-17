import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
};

type Committee = {
  id: string;
  name?: string;
  avatarUrl?: string;
  committeeName?: string;
  committeeDescription?: string;
  committeePhone?: string;
  committeeEmail?: string;
  committeeCity?: string;
  workingHours?: string;
  distributionPhotos?: string[];
};

export default function CommitteesScreen() {
  const router = useRouter();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Committee | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "committee"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Committee, "id">) }))
        .filter((c) => !!c.committeeName);
      setCommittees(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Committees</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : committees.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={C.muted} />
          <Text style={styles.emptyText}>No committees available</Text>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Tabs */}
          <ScrollView style={styles.tabList} showsVerticalScrollIndicator={false}>
            {committees.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.tabItem, selected?.id === c.id && styles.tabItemOn]}
                onPress={() => setSelected(c)}
              >
                {c.avatarUrl ? (
                  <Image source={{ uri: c.avatarUrl }} style={styles.tabAvatar} />
                ) : (
                  <View style={[styles.tabAvatar, styles.tabAvatarPh]}>
                    <Ionicons name="people" size={18} color="#fff" />
                  </View>
                )}
                <Text
                  style={[styles.tabName, selected?.id === c.id && styles.tabNameOn]}
                  numberOfLines={2}
                >
                  {c.committeeName ?? c.name ?? "Committee"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Details */}
          <ScrollView style={styles.detail} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!selected ? (
              <View style={styles.emptyDetail}>
                <Ionicons name="hand-left-outline" size={32} color={C.muted} />
                <Text style={styles.emptyDetailTxt}>Select a committee</Text>
              </View>
            ) : (
              <>
                {/* Avatar + Name */}
                <View style={styles.detailTop}>
                  {selected.avatarUrl ? (
                    <Image source={{ uri: selected.avatarUrl }} style={styles.detailAvatar} />
                  ) : (
                    <View style={[styles.detailAvatar, styles.detailAvatarPh]}>
                      <Ionicons name="people" size={28} color="#fff" />
                    </View>
                  )}
                  <Text style={styles.detailName}>
                    {selected.committeeName ?? selected.name ?? "Committee"}
                  </Text>
                  {selected.committeeCity ? (
                    <View style={styles.cityRow}>
                      <Ionicons name="location-outline" size={14} color={C.muted} />
                      <Text style={styles.cityText}>{selected.committeeCity}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Info */}
                <View style={styles.infoCard}>
                  {!!selected.committeeDescription && (
                    <View style={styles.infoRow}>
                      <Ionicons name="information-circle-outline" size={16} color={C.primary} />
                      <Text style={[styles.infoTxt, { flex: 1 }]}>{selected.committeeDescription}</Text>
                    </View>
                  )}
                  {!!selected.committeePhone && (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={16} color={C.primary} />
                      <Text style={styles.infoTxt}>{selected.committeePhone}</Text>
                    </View>
                  )}
                  {!!selected.committeeEmail && (
                    <View style={styles.infoRow}>
                      <Ionicons name="mail-outline" size={16} color={C.primary} />
                      <Text style={styles.infoTxt}>{selected.committeeEmail}</Text>
                    </View>
                  )}
                  {!!selected.workingHours && (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={16} color={C.primary} />
                      <Text style={styles.infoTxt}>{selected.workingHours}</Text>
                    </View>
                  )}
                </View>

                {/* Distribution Photos */}
                {selected.distributionPhotos && selected.distributionPhotos.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Distribution Photos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {selected.distributionPhotos.map((url, idx) => (
                          <Image
                            key={idx}
                            source={{ uri: url }}
                            style={{ width: 100, height: 100, borderRadius: 10 }}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                {/* View Full Profile */}
                <Pressable
                  style={styles.profileBtn}
                  onPress={() => router.push({
                    pathname: "/(private)/committee/[uid]" as any,
                    params: { uid: selected.id },
                  })}
                >
                  <Text style={styles.profileBtnTxt}>View Full Profile</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
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
  tabList: {
    width: 1,
    borderRightWidth: 1,
    borderRightColor: C.border,
    backgroundColor: C.card,
  },
  tabItem: {
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabItemOn: { backgroundColor: "#EDE5DE" },
  tabAvatar: { width: 44, height: 44, borderRadius: 22 },
  tabAvatarPh: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  tabName: { fontSize: 11, fontWeight: "600", color: C.muted, textAlign: "center" },
  tabNameOn: { color: C.primary, fontWeight: "800" },
  detail: { flex: 1 },
  emptyDetail: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  emptyDetailTxt: { fontSize: 14, color: C.muted },
  detailTop: { alignItems: "center", gap: 8, marginBottom: 4 },
  detailAvatar: { width: 72, height: 72, borderRadius: 36 },
  detailAvatarPh: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  detailName: { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cityText: { fontSize: 13, color: C.muted },
  infoCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoTxt: { fontSize: 13, color: C.text },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  profileBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  profileBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: C.muted },
});