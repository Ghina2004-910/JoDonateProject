import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { isEmailVerified, requireVerifiedMessage } from "@/lib/auth-email";
import { resolveCommitteeIdForItem } from "@/lib/committees";
import { createEligibilityReview } from "@/lib/eligibility-reviews";
import { auth, db } from "@/lib/firebase";

export type RequestStatus = "pending" | "approved" | "rejected";

export type DonationRequest = {
  id: string;
  itemId: string;
  itemOwnerId: string;
  requesterId: string;
  status: RequestStatus | string;
  createdAt?: unknown;
};

function requestAccessId(itemId: string, requesterId: string) {
  return `${itemId}_${requesterId}`;
}

export async function findActiveRequest(
  itemId: string,
  requesterId: string,
): Promise<DonationRequest | null> {
  const q = query(
    collection(db, "requests"),
    where("itemId", "==", itemId),
    where("requesterId", "==", requesterId),
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data() as Omit<DonationRequest, "id">;
    if (data.status === "pending" || data.status === "approved") {
      return { id: d.id, ...data };
    }
  }
  return null;
}

export async function hasApprovedRequestForItem(
  itemId: string,
  uidA: string,
  uidB: string,
): Promise<boolean> {
  if (!itemId || !uidA || !uidB) return false;
  const accessA = await getDoc(doc(db, "requestAccess", requestAccessId(itemId, uidA)));
  if (accessA.exists()) return true;
  const accessB = await getDoc(doc(db, "requestAccess", requestAccessId(itemId, uidB)));
  return accessB.exists();
}

export async function hasApprovedRequestBetweenUsers(
  uidA: string,
  uidB: string,
): Promise<boolean> {
  if (!uidA || !uidB || uidA === uidB) return false;
  const qA = query(
    collection(db, "requests"),
    where("requesterId", "==", uidA),
    where("itemOwnerId", "==", uidB),
    where("status", "==", "approved"),
  );
  const snapA = await getDocs(qA);
  if (!snapA.empty) return true;
  const qB = query(
    collection(db, "requests"),
    where("requesterId", "==", uidB),
    where("itemOwnerId", "==", uidA),
    where("status", "==", "approved"),
  );
  const snapB = await getDocs(qB);
  return !snapB.empty;
}

export async function canChatWithPeer(
  me: string,
  peerId: string,
  itemId?: string,
): Promise<boolean> {
  if (!me || !peerId || me === peerId) return false;
  if (itemId) return hasApprovedRequestForItem(itemId, me, peerId);
  return hasApprovedRequestBetweenUsers(me, peerId);
}

export async function createDonationRequest(
  itemId: string,
  itemOwnerId: string,
  requesterId: string,
): Promise<string> {
  if (!itemId || !itemOwnerId || !requesterId) {
    throw new Error("Missing request data.");
  }
  if (requesterId === itemOwnerId) {
    throw new Error("You cannot request your own donation.");
  }
  if (!isEmailVerified(auth.currentUser)) {
    throw new Error(requireVerifiedMessage());
  }

  const existing = await findActiveRequest(itemId, requesterId);
  if (existing) {
    throw new Error("You already have an active request for this item.");
  }

  const itemRef = doc(db, "items", itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error("Item not found.");
  const item = itemSnap.data() as { status?: string; title?: string; ownerId?: string };
  if (item.ownerId !== itemOwnerId) throw new Error("Item owner mismatch.");
  const status = item.status ?? "available";
  if (status !== "available" && status !== "requested") {
    throw new Error("This donation is no longer available.");
  }

  const profileSnap = await getDoc(doc(db, "users", requesterId));
  const requesterName = profileSnap.exists()
    ? String((profileSnap.data() as { name?: string }).name ?? "User")
    : "User";

  const requestRef = await addDoc(collection(db, "requests"), {
    itemId,
    itemOwnerId,
    requesterId,
    requesterName,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  const committeeId = await resolveCommitteeIdForItem(itemId);

  await createEligibilityReview({
    requestId: requestRef.id,
    itemId,
    requesterId,
    itemOwnerId,
    requesterName,
    committeeId,
  });

  await runTransaction(db, async (tx) => {
    const freshItem = await tx.get(itemRef);
    if (!freshItem.exists()) throw new Error("Item not found.");
    const fresh = freshItem.data() as { status?: string; title?: string };
    const freshStatus = fresh.status ?? "available";
    if (freshStatus !== "available" && freshStatus !== "requested") {
      throw new Error("This donation is no longer available.");
    }
    if (freshStatus === "available") {
      tx.update(itemRef, { status: "requested" });
    }
    const notifRef = doc(collection(db, "notifications"));
    tx.set(notifRef, {
      toUserId: itemOwnerId,
      title: "New donation request",
      body: `Someone requested "${fresh.title ?? "your donation"}".`,
      type: "request_received",
      itemId,
      requestId: requestRef.id,
      committeeId,
      read: false,
      createdAt: serverTimestamp(),
      fromUserId: requesterId,
    });
  });

  return requestRef.id;
}

export function canShowItemContact(
  itemOwnerId: string,
  viewerId: string | undefined,
  hasApprovedAccess: boolean,
): boolean {
  if (!viewerId) return false;
  if (viewerId === itemOwnerId) return true;
  return hasApprovedAccess;
}
