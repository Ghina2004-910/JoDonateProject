import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, limit, where } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { formatPostedTime } from "@/lib/format-posted";
import {
  CATEGORY_ICONS,
  DONATION_CATEGORIES,
  type DonationCategory,
} from "@/lib/donation-categories";
import { categoryScreenHref } from "@/lib/category-navigation";
import { ROUTES } from "@/lib/app-routes";
import { useAuth } from "@/lib/auth-context";
import { toggleFavoriteId } from "@/lib/favorites-storage";
import { db } from "@/lib/firebase";
import { useLocale } from "@/lib/locale-context";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  background: "#F5F3F0",
  text: "#2C2C2A",
  textSecondary: "#888888",
  card: "#FFFFFF",
  inputBg: "#F0F0F0",
  border: "#E0E0E0",
  amber: "#F5A623",
  redBadge: "#E24B4A",
};

const MAX_W = 380;
const SIDE_PAD = 24;
const HOT_CARD_W = 172;
const CAT_CARD_W = 96;

type ItemDoc = {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  city?: string;
  createdAt?: unknown;
};

const HOME_CATEGORY_PREVIEW = DONATION_CATEGORIES.slice(0, 8);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      where("read", "==", false),
    );
    return onSnapshot(q, (snap) => setUnreadCount(snap.size));
  }, [user?.uid, user?.isAnonymous]);

  const loadItems = useCallback(() => {
    const q = query(collection(db, "items"), orderBy("createdAt", "desc"), limit(40));
    return onSnapshot(
      q,
      (snap) => {
        const rows: ItemDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ItemDoc, "id">),
        }));
        setItems(rows);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("Home items listener:", err);
        setLoading(false);
        setRefreshing(false);
      },
    );
  }, []);

  useEffect(() => loadItems(), [loadItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const hotItems = useMemo(() => items.slice(0, 10), [items]);
  const recentItems = useMemo(() => items.slice(0, 12), [items]);
  const categoryCoverage = useMemo(
    () => new Set(items.map((i) => i.category).filter(Boolean)).size,
    [items],
  );

  const openItem = (id: string) => {
    router.push({ pathname: "/item/[id]", params: { id } });
  };

  const openCategory = (label: DonationCategory) => {
    router.push(categoryScreenHref(label));
  };

  const onFavoriteItem = (itemId: string) => {
    toggleFavoriteId(itemId).catch(() => {});
  };

  const screenW = Dimensions.get("window").width;
  const innerW = Math.min(screenW, MAX_W);

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <View style={[styles.headerInner, { maxWidth: MAX_W }]}>
          <Text style={styles.logo}>JO DONATE</Text>
          <View style={styles.headerIcons}>
            <Pressable hitSlop={10} onPress={() => router.push("/notifications")}>
              <View style={styles.bellWrap}>
                <Ionicons name="notifications-outline" size={24} color={C.primary} />
                {unreadCount > 0 ? (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadCount > 99 ? "99+" : String(unreadCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => router.push(ROUTES.favorites)}>
              <Ionicons name="heart-outline" size={24} color={C.primary} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => router.push("/settings")}>
              <Ionicons name="ellipsis-horizontal" size={22} color={C.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        contentContainerStyle={[styles.scrollPad, { paddingBottom: 100 }]}
      >
        <View style={[styles.column, { width: innerW, maxWidth: MAX_W }]}>
          <Pressable
            style={styles.searchBar}
            onPress={() => router.push("/donations")}
          >
            <Ionicons name="search-outline" size={20} color={C.primary} />
            <Text style={styles.searchPlaceholder}>{t("searchPlaceholder")}</Text>
          </Pressable>

          <Pressable style={styles.allCategoriesBtn} onPress={() => router.push("/categories")}>
            <Ionicons name="apps-outline" size={22} color="#FFFFFF" />
            <Text style={styles.allCategoriesBtnText}>View all categories</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.statsStrip}>
            <Pressable style={styles.statCell} onPress={() => router.push("/donations")}>
              <Text style={styles.statNum}>{items.length}</Text>
              <Text style={styles.statLbl}>Active listings</Text>
            </Pressable>
            <Pressable style={styles.statCell} onPress={() => router.push("/categories")}>
              <Text style={styles.statNum}>{DONATION_CATEGORIES.length}</Text>
              <Text style={styles.statLbl}>Categories</Text>
            </Pressable>
            <Pressable style={styles.statCell} onPress={() => router.push("/categories")}>
              <Text style={styles.statNum}>{categoryCoverage}</Text>
              <Text style={styles.statLbl}>In feed now</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {HOME_CATEGORY_PREVIEW.map((label) => (
              <Pressable
                key={label}
                style={[styles.catCard, { width: CAT_CARD_W }]}
                onPress={() => openCategory(label)}
              >
                <Ionicons name={CATEGORY_ICONS[label]} size={28} color={C.primary} />
                <Text style={styles.catName} numberOfLines={2}>
                  {label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.catCard, styles.seeAllCard, { width: CAT_CARD_W }]}
              onPress={() => router.push("/categories")}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={20} color={C.primary} />
            </Pressable>
          </ScrollView>

          <View style={styles.hotHeaderRow}>
            <Text style={styles.sectionTitle}>Hot Donations</Text>
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingText}>TRENDING</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={C.primary} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {hotItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.hotCard, { width: HOT_CARD_W }]}
                  onPress={() => openItem(item.id)}
                >
                  <View style={styles.hotImgWrap}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.hotImg} />
                    ) : (
                      <View style={[styles.hotImg, styles.hotImgPh]}>
                        <Ionicons name="image-outline" size={36} color={C.textSecondary} />
                      </View>
                    )}
                    <Pressable style={styles.cardHeart} onPress={() => onFavoriteItem(item.id)}>
                      <Ionicons name="heart-outline" size={20} color={C.primary} />
                    </Pressable>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText} numberOfLines={1}>
                        {item.category}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.hotTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color={C.textSecondary} />
                    <Text style={styles.locText} numberOfLines={1}>
                      {item.city ?? "Jordan"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Recent Donations</Text>
          {recentItems.map((item) => (
            <Pressable
              key={item.id}
              style={styles.recentCard}
              onPress={() => openItem(item.id)}
            >
              <View style={styles.recentRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.recentThumb} />
                ) : (
                  <View style={[styles.recentThumb, styles.recentThumbPh]}>
                    <Ionicons name="image-outline" size={24} color={C.textSecondary} />
                  </View>
                )}
                <View style={styles.recentBody}>
                  <Text style={styles.recentTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.recentCat}>{item.category}</Text>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color={C.textSecondary} />
                    <Text style={styles.locText}>{item.city ?? "Jordan"}</Text>
                  </View>
                </View>
                <Pressable style={styles.recentHeart} onPress={() => onFavoriteItem(item.id)}>
                  <Ionicons name="heart-outline" size={22} color={C.primary} />
                </Pressable>
              </View>
              <Text style={styles.postedTime}>{formatPostedTime(item.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <PrivateBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingTop: Platform.OS === "ios" ? 52 : 28,
  },
  headerBar: {
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingVertical: 16,
    paddingHorizontal: SIDE_PAD,
  },
  headerInner: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontSize: 16,
    fontWeight: "800",
    color: C.primary,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bellWrap: {
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.redBadge,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  scrollPad: {
    paddingTop: 16,
    alignItems: "center",
    paddingHorizontal: SIDE_PAD,
  },
  column: {
    alignSelf: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: C.textSecondary,
  },
  allCategoriesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    width: "100%",
    ...cardShadowSoft(),
  },
  allCategoriesBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  statsStrip: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    width: "100%",
  },
  statCell: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...cardShadowSoft(),
  },
  statNum: {
    fontSize: 18,
    fontWeight: "800",
    color: C.primary,
  },
  statLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.text,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  hScroll: {
    gap: 12,
    paddingBottom: 8,
    paddingRight: 8,
  },
  catCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 108,
    ...cardShadowSoft(),
  },
  seeAllCard: {
    justifyContent: "center",
    gap: 4,
  },
  catName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    lineHeight: 16,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.primary,
  },
  hotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
    marginBottom: 4,
  },
  trendingBadge: {
    backgroundColor: C.amber,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  hotCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    ...cardShadowSoft(),
  },
  hotImgWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },
  hotImg: {
    width: "100%",
    height: 110,
    borderRadius: 12,
  },
  hotImgPh: {
    backgroundColor: C.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeart: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
  },
  catBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(240,240,240,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "70%",
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
  },
  hotTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    lineHeight: 18,
    minHeight: 36,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  locText: {
    fontSize: 12,
    color: C.textSecondary,
    flex: 1,
  },
  recentCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    width: "100%",
    ...cardShadowSoft(),
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  recentThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
  },
  recentThumbPh: {
    backgroundColor: C.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  recentBody: {
    flex: 1,
    minWidth: 0,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
  },
  recentCat: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 4,
  },
  recentHeart: {
    padding: 4,
  },
  postedTime: {
    fontSize: 12,
    color: C.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
});