import AsyncStorage from "@react-native-async-storage/async-storage";

export const ADD_ITEM_DRAFT_KEY = "jodonate_add_donation_v2";

const SESSION_KEYS = [
  ADD_ITEM_DRAFT_KEY,
  "jodonate_route_intent_v1",
  "jodonate_pending_route",
] as const;

export async function clearUserSessionData(): Promise<void> {
  await Promise.all(SESSION_KEYS.map((key) => AsyncStorage.removeItem(key).catch(() => {})));
}
