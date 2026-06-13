import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { DEFAULT_COMMITTEE_ID, resolveCommitteeIdForItem } from "@/lib/committees";
import { notifyCommitteeOfNewReview } from "@/lib/committee-notifications";
import { db } from "@/lib/firebase";
import { createInAppNotification } from "@/lib/notifications";

export type EligibilityStatus = "pending" | "approved" | "rejected";

export async function createEligibilityReview(params: {
  requestId: string;
  itemId: string;
  requesterId: string;
  itemOwnerId: string;
  requesterName: string;
  committeeId?: string;
}): Promise<string> {
  const committeeId =
    params.committeeId?.trim() ||
    (await resolveCommitteeIdForItem(params.itemId)) ||
    DEFAULT_COMMITTEE_ID;

  const reviewRef = await addDoc(collection(db, "eligibilityReviews"), {
    requestId: params.requestId,
    itemId: params.itemId,
    requesterId: params.requesterId,
    itemOwnerId: params.itemOwnerId,
    requesterName: params.requesterName,
    committeeId,
    status: "pending" satisfies EligibilityStatus,
    createdAt: serverTimestamp(),
  });

  try {
  const committeeSnap = await getDocs(
    query(collection(db, "users"), where("committeeId", "==", committeeId), where("role", "in", ["committee", "admin"]))
  );
  await Promise.all(
    committeeSnap.docs.map((memberDoc) =>
      createInAppNotification({
        toUserId: memberDoc.id,
        title: "New donation request",
        body: `${params.requesterName} requested an item that needs your review.`,
        type: "committee_review_pending",
        itemId: params.itemId,
        requestId: params.requestId,
        reviewId: reviewRef.id,
        committeeId,
      })
    )
  );
} catch {
}

  return reviewRef.id;
}

export async function getEligibilityForRequest(
  requestId: string,
): Promise<{ status: EligibilityStatus; id: string; committeeId?: string } | null> {
  const q = query(
    collection(db, "eligibilityReviews"),
    where("requestId", "==", requestId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as { status?: EligibilityStatus; committeeId?: string };
  return {
    id: d.id,
    status: data.status ?? "pending",
    committeeId: data.committeeId,
  };
}

export async function isRequestEligibleForOwner(requestId: string): Promise<boolean> {
  const row = await getEligibilityForRequest(requestId);
  if (!row) return true;
  return row.status === "approved";
}

export async function reviewEligibility(
  reviewId: string,
  status: EligibilityStatus,
  reviewerId: string,
  notes?: string,
) {
  const ref = doc(db, "eligibilityReviews", reviewId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Review not found.");
  await updateDoc(ref, {
    status,
    reviewerId,
    notes: notes?.trim() || null,
    reviewedAt: serverTimestamp(),
  });
  const data = snap.data() as {
    requesterId?: string;
    itemId?: string;
    requestId?: string;
    itemOwnerId?: string;
    committeeId?: string;
  };

  if (status === "approved" && data.requesterId) {
  // Check if this is a committee donation
  const itemSnap2 = data.itemId ? await getDoc(doc(db, "items", data.itemId)) : null;
  const itemData2 = itemSnap2?.data() as { donationMode?: string; committeeUid?: string; ownerId?: string } | undefined;
  const isCommitteeDonation = itemData2?.donationMode === "committee";
  const donorId = itemData2?.ownerId ?? data.itemOwnerId;

  const { resolveCommitteeUid } = await import("@/lib/committees");
  const committeeUid =
  itemData2?.committeeUid ||
  (data.committeeId ? await resolveCommitteeUid(data.committeeId) : null);

  if (isCommitteeDonation && itemData2?.committeeUid) {
    // Open chat between committee and requester
    const { conversationIdForPair } = await import("@/lib/chat-utils");
    const { setDoc, doc: fsDoc } = await import("firebase/firestore");
    const conversationId = conversationIdForPair(data.requesterId, itemData2.committeeUid);
    const accessId = `${data.requesterId}_${itemData2.committeeUid}`;
    await setDoc(fsDoc(db, "requestAccess", accessId), {
      itemId: data.itemId ?? "committee_direct",
      requesterId: data.requesterId,
      itemOwnerId: itemData2.committeeUid,
    }, { merge: true });
    await setDoc(fsDoc(db, "conversations", conversationId), {
      participants: [data.requesterId, itemData2.committeeUid],
      lastMessageAt: serverTimestamp(),
      unreadBy: { [data.requesterId]: 1 },
      blocked: false,
      archivedFor: [],
      itemId: data.itemId,
    }, { merge: true });
    await createInAppNotification({
      toUserId: data.requesterId,
      title: "Request approved",
      body: "The committee approved your request. You can now chat with them.",
      type: "eligibility_approved",
      itemId: data.itemId ?? null,
      requestId: data.requestId ?? null,
      reviewId,
      committeeId: data.committeeId ?? null,
      fromUserId: reviewerId,
    });
  } else {
    await createInAppNotification({
      toUserId: data.requesterId,
      title: "Eligibility approved",
      body: "A committee approved your request. The donor can now accept it.",
      type: "eligibility_approved",
      itemId: data.itemId ?? null,
      requestId: data.requestId ?? null,
      reviewId,
      committeeId: data.committeeId ?? null,
      fromUserId: reviewerId,
    });
    if (data.itemOwnerId) {
      await createInAppNotification({
        toUserId: data.itemOwnerId,
        title: "Request ready for review",
        body: "Committee approved a donation request. You can accept or reject it.",
        type: "request_ready_owner",
        itemId: data.itemId ?? null,
        requestId: data.requestId ?? null,
        reviewId,
        committeeId: data.committeeId ?? null,
        fromUserId: reviewerId,
      });
    }
  }
}
  if (status === "rejected" && data.requestId && data.itemId) {
    const requestRef = doc(db, "requests", data.requestId);
    const itemRef = doc(db, "items", data.itemId);
    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(requestRef);
      const itemSnap = await tx.get(itemRef);
      if (reqSnap.exists()) {
        tx.update(requestRef, { status: "rejected" });
      }
      if (itemSnap.exists()) {
        const item = itemSnap.data() as { status?: string };
        if (item.status === "requested") {
          tx.update(itemRef, { status: "available" });
        }
      }
    });
    if (data.requesterId) {
      await createInAppNotification({
        toUserId: data.requesterId,
        title: "Request not eligible",
        body: "A committee could not approve your eligibility for this donation.",
        type: "eligibility_rejected",
        itemId: data.itemId ?? null,
        requestId: data.requestId ?? null,
        reviewId,
        committeeId: data.committeeId ?? null,
        fromUserId: reviewerId,
      });
    }
  }
}
