import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { decodeCategoryRouteParam } from "@/lib/category-navigation";
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
};

const MAX_W = 380;

type ItemDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  status?: string;
  ownerId: string;
  createdAt?: unknown;
};

function createdMs(v: unknown): number {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (v as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

export default function CategoryScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();

  const categoryName = useMemo(() => decodeCategoryRouteParam(name), [name]);

  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, "items"), where("category", "==", categoryName));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: ItemDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ItemDoc, "id">),
        }));
        data.sort((a, b) => createdMs(b.createdAt) - createdMs(a.createdAt));
        setItems(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const msg = err?.message ?? "Unknown error";
        setError(msg);
        setItems([]);
        setLoading(false);
      },
    );

    return unsub;
  }, [categoryName]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router, "/categories")} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {categoryName || "Category"}
        </Text>
        <Pressable onPress={() => router.push("/categories")} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="grid-outline" size={22} color={C.primary} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={40} color={C.primary} />
          <Text style={styles.errorTitle}>Could not load category</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Text style={styles.errorHint}>
            If you opened the URL manually, encode ampersands as %26 (example: Clothes%20%26%20Fashion).
            Deploy Firestore rules from this project: firebase deploy --only firestore:rules.
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => router.replace("/categories")}>
            <Text style={styles.retryBtnTxt}>All categories</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <Text style={styles.infoText}>Loading...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.infoText}>No items in this category yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPad}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              style={[styles.card, cardShadowSoft()]}
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
                <Text style={styles.sub} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>
          )}
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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: C.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  infoText: {
    color: C.muted,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  listPad: { padding: 16, paddingBottom: 32, maxWidth: MAX_W, width: "100%", alignSelf: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
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
    marginBottom: 4,
  },
  sub: {
    color: C.muted,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    padding: 20,
    alignItems: "center",
    gap: 10,
    maxWidth: MAX_W,
    alignSelf: "center",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  errorMsg: {
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  errorHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  retryBtnTxt: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
