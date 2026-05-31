import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "jodonate_favorite_ids";

export async function getFavoriteIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function isFavoriteId(itemId: string): Promise<boolean> {
  const ids = await getFavoriteIds();
  return ids.includes(itemId);
}


export async function toggleFavoriteId(itemId: string): Promise<boolean> {
  let ids = await getFavoriteIds();
  const i = ids.indexOf(itemId);
  if (i >= 0) {
    ids = [...ids.slice(0, i), ...ids.slice(i + 1)];
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
    return false;
  }
  ids = [itemId, ...ids.filter((id) => id !== itemId)].slice(0, 60);
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  return true;
}
