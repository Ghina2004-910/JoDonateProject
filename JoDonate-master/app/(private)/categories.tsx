import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PrivateBottomNav } from "@/components/private-bottom-nav";
import { categoryScreenHref } from "@/lib/category-navigation";
import { safeGoBack } from "@/lib/navigation";
import {
  CATEGORY_ICONS,
  DONATION_CATEGORIES,
  type DonationCategory,
} from "@/lib/donation-categories";
import { cardShadowSoft } from "@/lib/shadow-styles";

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  iconBg: "#EDE5DE",
};

const MAX_W = 380;

export default function AllCategoriesScreen() {
  const router = useRouter();

  const openCategory = (name: DonationCategory) => {
    router.push(categoryScreenHref(name));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router)} style={styles.hit}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>All Categories</Text>
        <Pressable
          hitSlop={12}
          onPress={() => router.push("/donations")}
          style={styles.hit}
          accessibilityLabel="Search donations"
        >
          <Ionicons name="search-outline" size={22} color={C.primary} />
        </Pressable>
      </View>

      <FlatList
        data={[...DONATION_CATEGORIES]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, cardShadowSoft()]}
            onPress={() => openCategory(item)}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={CATEGORY_ICONS[item]} size={26} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item}</Text>
              <Text style={styles.rowSub}>Browse listings in this category</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.muted} />
          </Pressable>
        )}
      />

      <PrivateBottomNav active="home" />
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
  },
  hit: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
            borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.iconBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: "500" },
});