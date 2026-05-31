import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ROUTES } from "@/lib/app-routes";
import {
  DEMO_ACCOUNTS,
  isDemoLoginEnabled,
  signInDemoAccount,
  type DemoAccount,
} from "@/lib/demo-accounts";
import { setPendingRoute } from "@/lib/route-intent";

const C = {
  primary: "#A0866B",
  bg: "#EDE5DE",
  text: "#2C2C2A",
  muted: "#888888",
  card: "#FFFFFF",
  admin: "#5C6BC0",
  committee: "#00897B",
  donor: "#A0866B",
  receiver: "#7B1FA2",
  guest: "#D4C4B0",
};

type Props = {
  compact?: boolean;
};

export function DemoRoleLogin({ compact }: Props) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  if (!isDemoLoginEnabled()) return null;

  const getRouteForRole = (key: DemoAccount["key"]) => {
    switch (key) {
      case "admin":
        return ROUTES.admin;
      case "committee":
        return ROUTES.committeeReviews;
      case "donor":
        return ROUTES.myItems;
      case "receiver":
        return ROUTES.donations;
      case "guest":
      default:
        return ROUTES.home;
    }
  };

  const onPick = async (account: DemoAccount) => {
    try {
      setLoadingKey(account.key);
      setPendingRoute(getRouteForRole(account.key));
      await signInDemoAccount(account);
    } catch (e: unknown) {
      setPendingRoute(null);
      Alert.alert(
        "Demo login failed",
        e instanceof Error
          ? e.message
          : "Enable Email/Password in Firebase Console, or check network.",
      );
    } finally {
      setLoadingKey(null);
    }
  };

  const colorFor = (key: DemoAccount["key"]) => {
    switch (key) {
      case "admin":
        return C.admin;
      case "committee":
        return C.committee;
      case "donor":
        return C.donor;
      case "receiver":
        return C.receiver;
      default:
        return C.guest;
    }
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.title}>Quick demo login</Text>
      <Text style={styles.hint}>Password for all: Demo1234!</Text>
      <View style={styles.grid}>
        {DEMO_ACCOUNTS.map((acc) => (
          <Pressable
            key={acc.key}
            style={[styles.chip, { borderColor: colorFor(acc.key) }]}
            disabled={!!loadingKey}
            onPress={() => void onPick(acc)}
          >
            {loadingKey === acc.key ? (
              <ActivityIndicator color={colorFor(acc.key)} />
            ) : (
              <>
                <Text style={[styles.chipLabel, { color: colorFor(acc.key) }]}>{acc.label}</Text>
                <Text style={styles.chipSub}>{acc.labelAr}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginTop: 20,
    padding: 14,
    backgroundColor: C.bg,
    borderRadius: 14,
    gap: 8,
  },
  wrapCompact: {
    marginTop: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  hint: {
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 4,
  },
  chip: {
    minWidth: "46%",
    flexGrow: 1,
    backgroundColor: C.card,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  chipSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
});
