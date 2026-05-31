import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function writeItemContactSecrets(
  itemId: string,
  ownerId: string,
  contactNumber: string,
  contactEmail: string | null,
) {
  await setDoc(doc(db, "itemSecrets", itemId), {
    contactNumber: contactNumber.trim(),
    contactEmail: contactEmail?.trim() || null,
    ownerId,
    updatedAt: serverTimestamp(),
  });
}
