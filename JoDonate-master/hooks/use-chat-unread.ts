import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { getAuthUser } from "@/lib/auth-user";


export function useChatUnreadTotal(): number {
  const { limitedGuest, user } = useAuth();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (limitedGuest) {
      setTotal(0);
      return;
    }
    const uid = user?.uid ?? getAuthUser()?.uid;
    if (!uid) {
      setTotal(0);
      return;
    }
    const q = query(collection(db, "conversations"), where("participants", "array-contains", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.forEach((docSnap) => {
          const u = (docSnap.data() as { unreadBy?: Record<string, number> }).unreadBy?.[uid] ?? 0;
          n += u;
        });
        setTotal(n);
      },
      () => setTotal(0),
    );
    return unsub;
  }, [limitedGuest, user?.uid]);

  return total;
}
