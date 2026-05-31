import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { isAdminRole, isCommitteeRole, normalizeRole, type UserRole } from "@/lib/roles";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || user.isAnonymous) {
      setRole("user");
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setRole(normalizeRole(snap.data()?.role));
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, user?.isAnonymous]);

  return {
    role,
    loading,
    isAdmin: isAdminRole(role),
    isCommittee: isCommitteeRole(role),
  };
}
