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
  const itemSnap = await getDoc(doc(db, "items", itemId));
  if (!itemSnap.exists()) return DEFAULT_COMMITTEE_ID;
  const data = itemSnap.data() as { city?: string };
  return resolveCommitteeIdForCity(data.city);
}

export async function resolveCommitteeIdForCity(city?: string): Promise<string> {
  const candidate = committeeIdFromCity(city);
  if (candidate === DEFAULT_COMMITTEE_ID) return DEFAULT_COMMITTEE_ID;

  const { getDocs, query, collection, where } = await import("firebase/firestore");
  const q = query(
    collection(db, "users"),
    where("committeeId", "==", candidate),
    where("role", "==", "committee"),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return candidate;

  return DEFAULT_COMMITTEE_ID;
}
export async function resolveCommitteeUid(committeeId: string): Promise<string | null> {
  if (!committeeId) return null;
  const { getDocs, query, collection, where } = await import("firebase/firestore");
  const q = query(
    collection(db, "users"),
    where("committeeId", "==", committeeId),
    where("role", "in", ["committee", "admin"])
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id; 
}
