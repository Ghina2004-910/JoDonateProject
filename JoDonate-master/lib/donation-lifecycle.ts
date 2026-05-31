import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createInAppNotifications } from "@/lib/notifications";

export async function notifyDonationCompleted(params: {
  itemId: string;
  ownerId: string;
  itemTitle: string;
}): Promise<void> {
  const reqQ = query(
    collection(db, "requests"),
    where("itemId", "==", params.itemId),
    where("status", "==", "approved"),
  );
  const reqSnap = await getDocs(reqQ);

  const notifications = [];

  if (!reqSnap.empty) {
    const requestDoc = reqSnap.docs[0];
    const req = requestDoc.data() as { requesterId?: string };
    if (req.requesterId && req.requesterId !== params.ownerId) {
      notifications.push({
        toUserId: req.requesterId,
        fromUserId: params.ownerId,
        title: "Donation completed",
        body: `"${params.itemTitle}" has been marked as donated. Thank you for requesting this item.`,
        type: "item_donated" as const,
        itemId: params.itemId,
        requestId: requestDoc.id,
      });
    }
  }

  notifications.push({
    toUserId: params.ownerId,
    fromUserId: params.ownerId,
    title: "Donation recorded",
    body: `You marked "${params.itemTitle}" as donated. The handoff is complete.`,
    type: "donation_completed" as const,
    itemId: params.itemId,
  });

  await createInAppNotifications(notifications);
}
