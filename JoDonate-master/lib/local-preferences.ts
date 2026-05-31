import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_KEY = "jodonate_profile_notifications_enabled";

export async function getProfileNotificationsEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(NOTIF_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export async function setProfileNotificationsEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIF_KEY, on ? "1" : "0");
}
