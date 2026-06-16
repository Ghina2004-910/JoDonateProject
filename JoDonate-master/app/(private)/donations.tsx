import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { toggleFavoriteId, getFavoriteIds } from "@/lib/favorites-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { useAuth } from "@/lib/auth-context";
import { formatPostedTime } from "@/lib/format-posted";
import { db } from "@/lib/firebase";
import { requestLocationForFilter, withinRadiusKm, type Coords } from "@/lib/location-filter";
import { useLocale } from "@/lib/locale-context";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  secondary: "#B39A86",
  background: "#F5F3F0",
  text: "#2C2C2A",
  textSecondary: "#888888",
  card: "#FFFFFF",
  inputBg: "#F0F0F0",
  border: "#E0E0E0",
};

const MAX_W = 380;
const FETCH = 80;

type ItemDoc = {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  city?: string;
  condition?: string;
  createdAt?: unknown;
  latitude?: number;
  longitude?: number;
};

const SORT_LABELS = ["Newest", "Oldest"] as const;
type SortKey = (typeof SORT_LABELS)[number];

const ALL_CATEGORY_LABELS = [
  "Food & Grocery",
  "Clothes & Fashion",
  "Services",
  "Company Equipment",
  "Games",
  "Electronics",
  "Sports & Fitness",
  "Education & Training",
  "Pets & Accessories",
  "Beauty & Health",
  "Books",
];

export default function DonationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { limitedGuest } = useAuth();
  const { t } = useLocale();

  const [rawItems, setRawItems] = useState<ItemDoc[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

useEffect(() => {
  getFavoriteIds().then((ids) => setFavIds(new Set(ids)));
}, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(params.q ?? "");
  const [sort, setSort] = useState<SortKey>("Newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState<string | null>(null);
  const [chipActive, setChipActive] = useState<"all" | "condition">("all");
  const [visibleCount, setVisibleCount] = useState(20);
  const [datePosted, setDatePosted] = useState<"any" | "24h" | "week" | "month">("any");
  const [locationQuery, setLocationQuery] = useState("");
  const [nearMe, setNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  useEffect(() => {
    const q = query(collection(db, "items"), orderBy("createdAt", "desc"), limit(FETCH));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRawItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ItemDoc, "id">) })),
        );
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsub;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const itemTime = (it: ItemDoc) =>
    it.createdAt &&
    typeof it.createdAt === "object" &&
    "toDate" in it.createdAt &&
    typeof (it.createdAt as { toDate: () => Date }).toDate === "function"
      ? (it.createdAt as { toDate: () => Date }).toDate().getTime()
      : 0;

  const filtered = useMemo(() => {
    let rows = [...rawItems];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q),
      );
    }
    if (selectedCats.size > 0) {
      rows = rows.filter((it) => selectedCats.has(it.category));
    }
    if (condition && condition !== "Any") {
      rows = rows.filter(
        (it) => (it.condition ?? "").toLowerCase() === condition.toLowerCase(),
      );
    }
    const loc = locationQuery.trim().toLowerCase();
    if (loc) {
      rows = rows.filter((it) => (it.city ?? "jordan").toLowerCase().includes(loc));
    }
    if (nearMe && userCoords) {
      rows = rows.filter((it) => withinRadiusKm(userCoords, it, 40));
    }
    const now = Date.now();
    const cut =
      datePosted === "any"
        ? 0
        : datePosted === "24h"
          ? now - 24 * 60 * 60 * 1000
          : datePosted === "week"
            ? now - 7 * 24 * 60 * 60 * 1000
            : now - 30 * 24 * 60 * 60 * 1000;
    if (datePosted !== "any") {
      rows = rows.filter((it) => itemTime(it) >= cut);
    }

   if (sort === "Oldest") rows.sort((a, b) => itemTime(a) - itemTime(b));
else rows.sort((a, b) => itemTime(b) - itemTime(a)); // Newest default

    return rows;
  }, [rawItems, search, selectedCats, condition, sort, datePosted, locationQuery, nearMe, userCoords]);

  const toggleNearMe = async () => {
    if (nearMe) {
      setNearMe(false);
      setUserCoords(null);
      return;
    }
    const coords = await requestLocationForFilter();
    if (!coords) return;
    setUserCoords(coords);
    setNearMe(true);
  };

  useEffect(() => {
    setVisibleCount(20);
  }, [search, selectedCats, condition, sort, datePosted, locationQuery, rawItems.length]);

  const cycleSort = () => {
    const i = SORT_LABELS.indexOf(sort);
    setSort(SORT_LABELS[(i + 1) % SORT_LABELS.length]);
  };

  const toggleCatFilter = (label: string) => {
    setSelectedCats((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  };

  const applyFilters = () => {
    setFilterOpen(false);
  };

  const clearFilters = () => {
  setSelectedCats(new Set());
  setCondition(null);
  setDatePosted("any");
  setLocationQuery("");
  setNearMe(false);
  setUserCoords(null);
  setChipActive("all");
};

  const onHeart = async (itemId: string) => {
  if (limitedGuest) {
    Alert.alert(
      "Please Login",
      "Sign in to save favorites.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/login") },
        { text: "Sign Up", onPress: () => router.push("/sign-up") },
      ],
    );
    return;
  }
  await toggleFavoriteId(itemId);
  const ids = await getFavoriteIds();
  setFavIds(new Set(ids));
};

  const openItem = (id: string) =>
    router.push({ pathname: "/item/[id]", params: { id } });

  const w = Dimensions.get("window").width;
  const colGap = 12;
  const pad = 24;
  const gridCardW = Math.min((Math.min(w, MAX_W) - pad * 2 - colGap) / 2, 175);

  const paged = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);

  const onLoadMore = () => {
    if (visibleCount >= filtered.length) return;
    setLoadMoreBusy(true);
    setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 20, filtered.length));
      setLoadMoreBusy(false);
    }, 400);
  };

  const renderGrid = ({ item }: { item: ItemDoc }) => (
    <Pressable
      style={[styles.gridCard, { width: gridCardW }]}
      onPress={() => openItem(item.id)}
    >
      <View style={styles.gridImgWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.gridImg} />
        ) : (
          <View style={[styles.gridImg, styles.ph]}>
            <Ionicons name="image-outline" size={32} color={C.textSecondary} />
          </View>
        )}
        <Pressable style={styles.heartAbs} onPress={() => onHeart(item.id)}>
  <Ionicons
    name={favIds.has(item.id) ? "heart" : "heart-outline"}
    size={20}
    color={favIds.has(item.id) ? "#E24B4A" : C.primary}
  />
</Pressable>
        <View style={styles.badgeAbs}>
          <Text style={styles.badgeTxt} numberOfLines={1}>
            {item.category}
          </Text>
        </View>
      </View>
      <Text style={styles.gridTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.locRow}>
        <Ionicons name="location-outline" size={12} color={C.textSecondary} />
        <Text style={styles.locSmall} numberOfLines={1}>
          {item.city ?? "Jordan"}
        </Text>
      </View>
      <Text style={styles.dateSmall}>{formatPostedTime(item.createdAt)}</Text>
    </Pressable>
  );

  const renderList = ({ item }: { item: ItemDoc }) => (
    <Pressable style={styles.listCard} onPress={() => openItem(item.id)}>
      <View style={styles.listRow}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.listThumb} />
        ) : (
          <View style={[styles.listThumb, styles.ph]}>
            <Ionicons name="image-outline" size={22} color={C.textSecondary} />
          </View>
        )}
        <View style={styles.listBody}>
          <Text style={styles.listTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.listCat}>{item.category}</Text>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
            <Text style={styles.locSmall}>{item.city ?? "Jordan"}</Text>
          </View>
          {item.condition ? (
            <View style={styles.condPill}>
              <Text style={styles.condPillTxt}>{item.condition}</Text>
            </View>
          ) : null}
          <Text style={styles.dateSmall}>{formatPostedTime(item.createdAt)}</Text>
        </View>
        <Pressable onPress={() => onHeart(item.id)} style={{ padding: 4 }}>
          <Ionicons
  name={favIds.has(item.id) ? "heart" : "heart-outline"}
  size={20}
  color={favIds.has(item.id) ? "#E24B4A" : C.primary}
/>
        </Pressable>
      </View>
    </Pressable>
  );

  const CONDITIONS = ["Any", "New", "Like New", "Good", "Fair", "Used"];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: MAX_W }]}>
          <View style={styles.headerTop}>
            <Text style={styles.pageTitle}>All Donations</Text> 
            <View style={styles.headerActions}>
              <Pressable onPress={() => setView("grid")}>
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={view === "grid" ? C.primary : C.textSecondary}
                />
              </Pressable>
              <Pressable onPress={() => setView("list")}>
                <Ionicons
                  name="list-outline"
                  size={20}
                  color={view === "list" ? C.primary : C.textSecondary}
                />
              </Pressable>
              <Pressable onPress={() => setFilterOpen(true)} hitSlop={8}>
                <Ionicons name="funnel-outline" size={22} color={C.primary} />
              </Pressable>
            </View>
          </View>
          <Pressable onPress={cycleSort} style={styles.sortRow}>
            <Text style={styles.sortText}>Sort: {sort}</Text>
            <Ionicons name="chevron-down" size={18} color={C.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.toolbar, { maxWidth: MAX_W }]}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={C.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search donations..."
            placeholderTextColor={C.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable
  style={[styles.chip, { backgroundColor: "#B39A86", width: "100%", paddingVertical: 14, marginTop: 8, marginBottom:9 }]}
  onPress={() => router.push("/(private)/committees" as any)}
>
  <Text style={[styles.chipTxt, { color: "#fff", textAlign: "center" }]}>All Committees</Text>
</Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Pressable
            style={[
              styles.chip,
              chipActive === "all" && selectedCats.size === 0 && styles.chipOn,
            ]}
            onPress={() => {
              setChipActive("all");
              setSelectedCats(new Set());
            }}
          >
            <Text
              style={[
                styles.chipTxt,
                chipActive === "all" && selectedCats.size === 0 && styles.chipTxtOn,
              ]}
            >
              All Categories
            </Text>
          </Pressable>
          <Pressable
  style={[styles.chip, selectedCats.size > 0 && styles.chipOn]}
  onPress={() => setFilterOpen(true)}
>
  <Text style={[styles.chipTxt, selectedCats.size > 0 && styles.chipTxtOn]}>
    {selectedCats.size > 0 ? `Category (${selectedCats.size})` : "Category"}
  </Text>
</Pressable>
<Pressable
  style={[styles.chip, chipActive === "condition" && styles.chipOn]}
  onPress={() => {
    setChipActive("condition");
    setFilterOpen(true);
  }}
>
  <Text style={[styles.chipTxt, chipActive === "condition" && styles.chipTxtOn]}>
    Condition
  </Text>
</Pressable>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={C.primary} />
          <Text style={styles.emptyTitle}>No donations found</Text>
          <Text style={styles.emptySub}>Try adjusting your filters or search terms</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => {
              setSearch("");
              clearFilters();
            }}
          >
            <Text style={styles.emptyBtnTxt}>Browse all categories</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={view}
          data={paged}
          keyExtractor={(it) => it.id}
          numColumns={view === "grid" ? 2 : 1}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          columnWrapperStyle={view === "grid" ? styles.gridRowWrap : undefined}
          contentContainerStyle={[
            styles.listContent,
            view === "grid" ? styles.listContentGrid : styles.listContentList,
            { paddingBottom: 100 },
          ]}
          renderItem={view === "grid" ? renderGrid : renderList}
          ListFooterComponent={
            visibleCount < filtered.length ? (
              <View style={styles.loadMoreWrap}>
                {loadMoreBusy ? (
                  <ActivityIndicator color={C.primary} />
                ) : (
                  <Pressable style={styles.loadMoreBtn} onPress={onLoadMore}>
                    <Text style={styles.loadMoreTxt}>Load more</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      )}

  <Modal visible={filterOpen} animationType="slide" transparent>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>

      {/* Header */}
      <View style={styles.modalHead}>
        <Text style={styles.modalTitle}>Filters</Text>
        <Pressable onPress={() => setFilterOpen(false)}>
          <Ionicons name="close" size={26} color={C.text} />
        </Pressable>
      </View>

      {/* المحتوى كله scrollable */}
      <ScrollView showsVerticalScrollIndicator={false}>

        <Text style={styles.modalSection}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
  {ALL_CATEGORY_LABELS.map((cat) => (
    <Pressable
      key={cat}
      style={[
        styles.catFilterChip,
        selectedCats.has(cat) && styles.catFilterChipOn,
      ]}
      onPress={() => toggleCatFilter(cat)}
    >
      <Text
        style={[
          styles.catFilterChipTxt,
          selectedCats.has(cat) && styles.catFilterChipTxtOn,
        ]}
      >
        {cat}
      </Text>
    </Pressable>
  ))}
</View>

        <Text style={styles.modalSection}>Location</Text>
        <TextInput
          style={styles.locInput}
          placeholder="City or region (e.g. Amman)"
          placeholderTextColor={C.textSecondary}
          value={locationQuery}
          onChangeText={setLocationQuery}
        />

        <Text style={styles.modalSection}>Date posted</Text>
        {(
          [
            ["any", "Anytime"],
            ["24h", "Last 24h"],
            ["week", "Last week"],
            ["month", "Last month"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={styles.radioRow}
            onPress={() => setDatePosted(key)}
          >
            <Ionicons
              name={datePosted === key ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={datePosted === key ? C.primary : C.textSecondary}
            />
            <Text style={styles.checkLabel}>{label}</Text>
          </Pressable>
        ))}

        <Text style={styles.modalSection}>Condition</Text>
        {CONDITIONS.filter((c) => c !== "Any").map((c) => (
          <Pressable
            key={c}
            style={styles.radioRow}
            onPress={() => setCondition(condition === c ? null : c)}
          >
            <Ionicons
              name={condition === c ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={condition === c ? C.primary : C.textSecondary}
            />
            <Text style={styles.checkLabel}>{c}</Text>
          </Pressable>
        ))}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* down*/}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          style={[styles.applyBtn, { flex: 1, backgroundColor: "#eee" }]}
          onPress={clearFilters}
        >
          <Text style={[styles.applyBtnTxt, { color: "#555" }]}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.applyBtn, { flex: 2 }]}
          onPress={applyFilters}
        >
          <Text style={styles.applyBtnTxt}>Apply</Text>
        </Pressable>
      </View>

    </View>
  </View>
</Modal>

      <PrivateBottomNav active="donations" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  header: {
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerInner: {
    width: "100%",
    alignSelf: "center",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  sortText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textSecondary,
  },
  toolbar: {
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
  },
  chips: {
    marginBottom: 8,
    maxHeight: 44,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: C.inputBg,
    marginRight: 10,
  },
  chipOn: {
    backgroundColor: C.primary,
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primary,
  },
  chipTxtOn: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  listContentGrid: {
    alignItems: "stretch",
  },
  listContentList: {
    alignItems: "center",
  },
  loadMoreWrap: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    paddingVertical: 20,
    alignItems: "center",
  },
  loadMoreBtn: {
    backgroundColor: "#B39A86",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  loadMoreTxt: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  locInput: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    marginBottom: 4,
  },
  gridRowWrap: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  gridCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    ...cardShadowSoft(),
  },
  gridImgWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  gridImg: {
    width: "100%",
    height: 120,
    borderRadius: 12,
  },
  ph: {
    backgroundColor: C.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  heartAbs: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
  },
  badgeAbs: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(240,240,240,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "75%",
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    minHeight: 36,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  locSmall: {
    fontSize: 12,
    color: C.textSecondary,
    flex: 1,
  },
  dateSmall: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 6,
  },
  listCard: {
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...cardShadowSoft(),
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  listThumb: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  listBody: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
  },
  listCat: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 4,
  },
  condPill: {
    alignSelf: "flex-start",
    backgroundColor: C.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  condPillTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textSecondary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    paddingBottom: 120,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: C.secondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnTxt: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 22,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    maxHeight: "85%",
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
  },
  modalSection: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    marginBottom: 10,
    marginTop: 8,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  checkLabel: {
    fontSize: 14,
    color: C.text,
  },
  applyBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  applyBtnTxt: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  clearTxt: {
    textAlign: "center",
    marginTop: 14,
    color: C.textSecondary,
    fontWeight: "600",
  },
  catFilterChip: {
  width: "47%",
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
  backgroundColor: C.inputBg,
  borderWidth: 1,
  borderColor: C.border,
},
catFilterChipOn: {
  backgroundColor: C.primary,
  borderColor: C.primary,
},
catFilterChipTxt: {
  fontSize: 13,
  fontWeight: "600",
  color: C.text,
},
catFilterChipTxtOn: {
  color: "#FFFFFF",
},
});