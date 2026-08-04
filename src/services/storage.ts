/**
 * Tiny AsyncStorage-backed key/value store for recent destinations & prefs.
 * Keeps the API narrow so we can swap in MMKV later without touching callers.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecentDestination } from "@/types";

const KEY_RECENTS = "tb.recents.v1";
const MAX_RECENTS = 8;
const KEY_USER_NAME = "tb.userName.v1";

export async function getUserName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_USER_NAME);
  } catch {
    return null;
  }
}

export async function setUserName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEY_USER_NAME, name.trim());
}

export async function getRecents(): Promise<RecentDestination[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_RECENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRecent(entry: RecentDestination): Promise<void> {
  const current = await getRecents();
  const dedup = current.filter((r) => r.id !== entry.id);
  const next = [entry, ...dedup].slice(0, MAX_RECENTS);
  await AsyncStorage.setItem(KEY_RECENTS, JSON.stringify(next));
}

export async function clearRecents(): Promise<void> {
  await AsyncStorage.removeItem(KEY_RECENTS);
}
