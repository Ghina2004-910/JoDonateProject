import { doc, onSnapshot } from "firebase/firestore";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { isAdminRole, isCommitteeRole, normalizeRole, type UserRole } from "@/lib/roles";
import { DEFAULT_COMMITTEE_ID } from "@/lib/committees";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  committeeId?: string;
  browseOnly: boolean;
  demoAccount?: string;
  demoPersona?: "donor" | "receiver";
  verified?: boolean;
};

type UserProfileContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole;
  committeeId: string;
  isAdmin: boolean;
  isCommittee: boolean;
  isDonor: boolean;
  isReceiver: boolean;
  isBrowseOnly: boolean;
};

const defaultValue: UserProfileContextValue = {
  profile: null,
  loading: true,
  role: "user",
  committeeId: "default",
  isAdmin: false,
  isCommittee: false,
  isDonor: false,
  isReceiver: false,
  isBrowseOnly: false,
};

const UserProfileContext = createContext<UserProfileContextValue>(defaultValue);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: user.uid,
            name: data.name ?? "User",
            email: data.email ?? user.email ?? "",
            phone: data.phone,
            role: normalizeRole(data.role),
            committeeId: String(data.committeeId ?? DEFAULT_COMMITTEE_ID),
            browseOnly: data.browseOnly === true,
            demoAccount: data.demoAccount,
            demoPersona: data.demoPersona,
            verified: data.verified === true,
          });
        } else {
          setProfile({
            uid: user.uid,
            name: user.displayName ?? "User",
            email: user.email ?? "",
            role: "user",
            browseOnly: false,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error("UserProfile snapshot error:", error);
        setProfile({
          uid: user.uid,
          name: user.displayName ?? "User",
          email: user.email ?? "",
          role: "user",
          browseOnly: false,
        });
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid, authLoading]);

  const value = useMemo<UserProfileContextValue>(() => {
    const role = profile?.role ?? "user";
    const committeeId = profile?.committeeId?.trim() || DEFAULT_COMMITTEE_ID;
    return {
      profile,
      loading: authLoading || loading,
      role,
      committeeId,
      isAdmin: isAdminRole(role),
      isCommittee: isCommitteeRole(role),
      isDonor: profile?.demoPersona === "donor" || (!profile?.demoPersona && role === "user" && !profile?.browseOnly),
      isReceiver: profile?.demoPersona === "receiver",
      isBrowseOnly: profile?.browseOnly ?? false,
    };
  }, [profile, loading, authLoading]);

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
