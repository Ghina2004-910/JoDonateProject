import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

type NotifyCommitteeParams = {
  reviewId: string;
  requestId: string;
  itemId: string;
  requesterId: string;
  requesterName: string;
  committeeId?: string;
};

type NotifyCommitteeResponse = {
  notified: number;
};

export async function notifyCommitteeOfNewReview(params: NotifyCommitteeParams): Promise<number> {
  const callable = httpsCallable<NotifyCommitteeParams, NotifyCommitteeResponse>(
    functions,
    "notifyCommitteeOfReview",
  );
  const { data } = await callable(params);
  return data.notified ?? 0;
}
