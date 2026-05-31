import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { db } from "@/lib/firebase";
import { getFavoriteIds, toggleFavoriteId } from "@/lib/favorites-storage";
import { useLocale } from "@/lib/locale-context";
import { safeGoBack } from "@/lib/navigation";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
};

type FavItem = {
  id: string;
  title: string;
  imageUrl?: string;
  city?: string;
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FavItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await getFavoriteIds();
      const rows = await Promise.all(
        ids.map(async (id) => {
          const snap = await getDoc(doc(db, "items", id));
          if (!snap.exists()) return null;
          const data = snap.data() as { title?: string; imageUrl?: string; city?: string };
          return {
            id,
            title: data.title ?? "Item",
            imageUrl: data.imageUrl,
            city: data.city,
          };
        }),
      );
      setItems(rows.filter((r) => r != null) as FavItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router)}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("favorites")}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={48} color={C.muted} />
          <Text style={styles.emptyTxt}>{t("noFavorites")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, cardShadowSoft()]}
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <Ionicons name="image-outline" size={24} color={C.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  void toggleFavoriteId(item.id).then(() => load());
                }}
              >
                <Ionicons name="heart" size={22} color="#E24B4A" />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <PrivateBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 52 : 28 },
  header: {
    backgroundColor: C.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTxt: { color: C.muted, fontSize: 15 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbPh: { backgroundColor: "#EDE5DE", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700", color: C.text },
  city: { fontSize: 12, color: C.muted, marginTop: 4 },
});
