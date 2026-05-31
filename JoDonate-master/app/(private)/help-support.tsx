import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { cardShadowSoft } from "@/lib/shadow-styles";
import { safeGoBack } from "@/lib/navigation";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  primary: "#A0866B",
  bg: "#F5F3F0",
  card: "#FFFFFF",
  text: "#2C2C2A",
  muted: "#888888",
  border: "#E0E0E0",
  inputBg: "#F0F0F0",
  iconCircle: "#EDE5DE",
};

const MAX_W = 380;

const CATEGORIES = [
  {
    key: "start",
    title: "Getting Started",
    desc: "Learn how Jo Donate works",
    icon: "rocket-outline" as const,
  },
  {
    key: "account",
    title: "Account & Profile",
    desc: "Manage your account settings",
    icon: "person-outline" as const,
  },
  {
    key: "post",
    title: "Posting Donations",
    desc: "Tips for clear listings",
    icon: "add-circle-outline" as const,
  },
  {
    key: "find",
    title: "Finding Donations",
    desc: "Search and request items",
    icon: "search-outline" as const,
  },
  {
    key: "safety",
    title: "Safety & Trust",
    desc: "Meet safely and report issues",
    icon: "shield-checkmark-outline" as const,
  },
];

const FAQ = [
  {
    q: "How do I post a donation?",
    a: "Tap Add on the bottom bar, fill in details and photos, then publish your listing.",
  },
  {
    q: "How do requests work?",
    a: "Open an item, tap Request, and wait for the donor to approve. You'll get a notification.",
  },
  {
    q: "Is messaging safe?",
    a: "Use in-app chat first. Avoid sharing sensitive data until you're comfortable.",
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredCats = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CATEGORIES;
    return CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(s) || c.desc.toLowerCase().includes(s),
    );
  }, [q]);

  const filteredFaq = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return FAQ;
    return FAQ.filter((f) => f.q.toLowerCase().includes(s) || f.a.toLowerCase().includes(s));
  }, [q]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => safeGoBack(router, "/profile")} style={styles.hit}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <Pressable hitSlop={12} style={styles.hit}>
          <Ionicons name="search-outline" size={22} color={C.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color={C.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search help topics..."
              placeholderTextColor={C.muted}
              style={styles.searchInput}
            />
          </View>

          {filteredCats.map((c) => (
            <Pressable
              key={c.key}
              style={({ pressed }) => [styles.catCard, pressed && styles.pressed]}
              onPress={() =>
                Alert.alert(c.title, `${c.desc}. More articles will be added soon.`)
              }
            >
              <View style={styles.catIcon}>
                <Ionicons name={c.icon} size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.catTitle}>{c.title}</Text>
                <Text style={styles.catDesc}>{c.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>FAQ</Text>
          {filteredFaq.map((item, i) => {
            const open = openFaq === i;
            return (
              <Pressable
                key={item.q}
                style={[styles.faqCard, cardShadowSoft()]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenFaq(open ? null : i);
                }}
              >
                <View style={styles.faqHead}>
                  <Text style={styles.faqQ}>{item.q}</Text>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={C.muted}
                  />
                </View>
                {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
              </Pressable>
            );
          })}

          <Pressable
            style={styles.contactBtn}
            onPress={() =>
              Alert.alert(
                "Contact Support",
                "Email us at support@jodonate.app and we’ll get back to you shortly.",
              )
            }
          >
            <Text style={styles.contactBtnText}>Contact Support</Text>
          </Pressable>

          <Text style={styles.footerNote}>support@jodonate.app</Text>
        </View>
      </ScrollView>
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.card,
    maxWidth: MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  hit: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  scroll: { paddingBottom: 40 },
  inner: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: C.text,
    padding: 0,
  },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...cardShadowSoft(),
  },
  pressed: { opacity: 0.92 },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.iconCircle,
    alignItems: "center",
    justifyContent: "center",
  },
  catTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  catDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    marginTop: 18,
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  faqHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "700", color: C.text },
  faqA: {
    fontSize: 13,
    color: C.muted,
    marginTop: 10,
    lineHeight: 20,
    fontWeight: "500",
  },
  contactBtn: {
    marginTop: 20,
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
  },
  contactBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  footerNote: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 12,
    color: C.muted,
    fontWeight: "600",
  },
});
