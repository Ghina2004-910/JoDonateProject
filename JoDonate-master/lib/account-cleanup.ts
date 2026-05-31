import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const BATCH_LIMIT = 400;

async function deleteQueryBatch(q: ReturnType<typeof query>) {
  const snap = await getDocs(q);
  if (snap.empty) return;
  let batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count += 1;
    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function deleteRequestAccessForUser(uid: string) {
  const asRequester = await getDocs(
    query(collection(db, "requests"), where("requesterId", "==", uid)),
  );
  const asOwner = await getDocs(
    query(collection(db, "requests"), where("itemOwnerId", "==", uid)),
  );

  const accessIds = new Set<string>();
  for (const req of asRequester.docs) {
    const data = req.data() as { itemId?: string };
    if (data.itemId) accessIds.add(`${data.itemId}_${uid}`);
  }
  for (const req of asOwner.docs) {
    const data = req.data() as { itemId?: string; requesterId?: string };
    if (data.itemId && data.requesterId) {
      accessIds.add(`${data.itemId}_${data.requesterId}`);
    }
  }

  await Promise.all(
    Array.from(accessIds).map((id) => deleteDoc(doc(db, "requestAccess", id)).catch(() => {})),
  );
}

export async function deleteUserFirestoreData(uid: string): Promise<void> {
  const ownedItems = await getDocs(query(collection(db, "items"), where("ownerId", "==", uid)));
  for (const itemDoc of ownedItems.docs) {
    try {
      await deleteDoc(doc(db, "itemSecrets", itemDoc.id));
    } catch {
      /* may not exist */
    }
  }
  await deleteQueryBatch(query(collection(db, "items"), where("ownerId", "==", uid)));

  await deleteQueryBatch(
    query(collection(db, "requests"), where("requesterId", "==", uid)),
  );
  await deleteQueryBatch(
    query(collection(db, "requests"), where("itemOwnerId", "==", uid)),
  );
  await deleteQueryBatch(
    query(collection(db, "notifications"), where("toUserId", "==", uid)),
  );
  await deleteQueryBatch(
    query(collection(db, "eligibilityReviews"), where("requesterId", "==", uid)),
  );
  await deleteQueryBatch(
    query(collection(db, "eligibilityReviews"), where("itemOwnerId", "==", uid)),
  );
  await deleteQueryBatch(
    query(collection(db, "committeeMembers"), where("userId", "==", uid)),
  );

  await deleteRequestAccessForUser(uid);

  const convSnap = await getDocs(collection(db, "conversations"));
  for (const conv of convSnap.docs) {
    const data = conv.data() as { participants?: string[] };
    if (!data.participants?.includes(uid)) continue;
    const msgs = await getDocs(collection(db, "conversations", conv.id, "messages"));
    let batch = writeBatch(db);
    let n = 0;
    for (const m of msgs.docs) {
      batch.delete(m.ref);
      n += 1;
      if (n >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
    await deleteDoc(conv.ref);
  }

  await deleteDoc(doc(db, "users", uid)).catch(() => {});
}
