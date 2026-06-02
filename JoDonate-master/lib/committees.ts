import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const DEFAULT_COMMITTEE_ID = "default";

/** Maps an item city label to a committee document id. */
export function committeeIdFromCity(city?: string): string {
  if (!city?.trim()) return DEFAULT_COMMITTEE_ID;
  const slug = city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || DEFAULT_COMMITTEE_ID;
}

export async function resolveCommitteeIdForItem(itemId: string): Promise<string> {
  return DEFAULT_COMMITTEE_ID;
}

export async function resolveCommitteeIdForCity(city?: string): Promise<string> {
  const candidate = committeeIdFromCity(city);
  if (candidate === DEFAULT_COMMITTEE_ID) return DEFAULT_COMMITTEE_ID;

  const committeeSnap = await getDoc(doc(db, "committees", candidate));
  if (committeeSnap.exists() && committeeSnap.data()?.active !== false) {
    return candidate;
  }
  return DEFAULT_COMMITTEE_ID;
}

export async function getUserCommitteeId(userId: string): Promise<string> {
  const userSnap = await getDoc(doc(db, "users", userId));
  if (userSnap.exists()) {
    const committeeId = String(
      (userSnap.data() as { committeeId?: string }).committeeId ?? "",
    ).trim();
    if (committeeId) return committeeId;
  }
  return DEFAULT_COMMITTEE_ID;
}
