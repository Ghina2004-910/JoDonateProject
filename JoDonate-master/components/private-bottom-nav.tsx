import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useChatUnreadTotal } from "@/hooks/use-chat-unread";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

export type PrivateBottomTab = "home" | "donations" | "add" | "chat" | "profile";

const C = {
  primary: "#A0866B",
  muted: "#888888",
  navBg: "#FFFFFF",
  border: "#E0E0E0",
  chatBadge: "#E24B4A",
};

type Props = {
  active: PrivateBottomTab;
};

export function PrivateBottomNav({ active }: Props) {
  const router = useRouter();
  const { limitedGuest } = useAuth();
  const { t } = useLocale();
  const chatUnread = useChatUnreadTotal();

  const guestGate = (afterLogin: () => void) => {
    if (!limitedGuest) {
      afterLogin();
      return;
    }
    Alert.alert(
      "Please login to use this feature",
      "Sign in or create an account to continue.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/login") },
        { text: "Sign Up", onPress: () => router.push("/sign-up") },
      ],
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Platform.OS === "ios" ? 22 : 12 }]}>
      <Pressable
        style={styles.tab}
        onPress={() => router.replace("/(private)")}
        accessibilityLabel="Home"
      >
        <Ionicons
          name={active === "home" ? "home" : "home-outline"}
          size={28}
          color={active === "home" ? C.primary : C.muted}
        />
        <Text style={[styles.label, active === "home" && styles.labelActive]}>{t("home")}</Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => router.replace("/(private)/donations")}
        accessibilityLabel="Donations"
      >
        <Ionicons
          name={active === "donations" ? "list" : "list-outline"}
          size={28}
          color={active === "donations" ? C.primary : C.muted}
        />
        <Text style={[styles.label, active === "donations" && styles.labelActive]}>
          {t("donations")}
        </Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => guestGate(() => router.push("/add-item"))}
        accessibilityLabel="Add donation"
      >
        <Ionicons name="add-circle-outline" size={32} color={C.muted} />
        <Text style={styles.label}>{t("add")}</Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => guestGate(() => router.push("/chats"))}
        accessibilityLabel="Chat"
      >
        <View style={styles.chatIconWrap}>
          <Ionicons
            name={active === "chat" ? "chatbubbles" : "chatbubbles-outline"}
            size={28}
            color={active === "chat" ? C.primary : C.muted}
          />
          {chatUnread > 0 ? (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{chatUnread > 9 ? "9+" : chatUnread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, active === "chat" && styles.labelActive]}>{t("chat")}</Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => router.push("/profile")}
        accessibilityLabel="Profile"
      >
        <Ionicons
          name={active === "profile" ? "person" : "person-outline"}
          size={28}
          color={active === "profile" ? C.primary : C.muted}
        />
        <Text style={[styles.label, active === "profile" && styles.labelActive]}>{t("profile")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 70,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
    backgroundColor: C.navBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
  },
  labelActive: {
    color: C.primary,
  },
  chatIconWrap: {
    position: "relative",
  },
  chatBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.chatBadge,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
