import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationType =
  | "request_received"
  | "request_approved"
  | "request_rejected"
  | "eligibility_approved"
  | "eligibility_rejected"
  | "request_ready_owner"
  | "committee_review_pending"
  | "item_donated"
  | "donation_completed"
  | "donor_contact_admin";

export type InAppNotificationInput = {
  toUserId: string;
  title: string;
  body: string;
  type: NotificationType;
  fromUserId?: string;
  itemId?: string | null;
  requestId?: string | null;
  reviewId?: string | null;
  committeeId?: string | null;
};

export async function createInAppNotification(input: InAppNotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, "notifications"), {
    toUserId: input.toUserId,
    title: input.title,
    body: input.body,
    type: input.type,
    fromUserId: input.fromUserId ?? null,
    itemId: input.itemId ?? null,
    requestId: input.requestId ?? null,
    reviewId: input.reviewId ?? null,
    committeeId: input.committeeId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createInAppNotifications(
  inputs: InAppNotificationInput[],
): Promise<void> {
  await Promise.all(inputs.map((input) => createInAppNotification(input)));
}
