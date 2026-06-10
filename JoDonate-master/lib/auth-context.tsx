import { onAuthStateChanged, signOut, User } from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setDevAuthOverride } from "@/lib/auth-user";
import { isDemoGuestEmail } from "@/lib/demo-accounts";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";
import { auth } from "@/lib/firebase";
import { loadLocale } from "@/lib/i18n";
import { clearUserSessionData } from "@/lib/session-cleanup";

const devAuthActive = __DEV__ && SKIP_FIREBASE_AUTH;

const MOCK_USER = {
  uid: "dev-frontend-user",
  email: "dev@jodonate.local",
  isAnonymous: false,
} as User;

const MOCK_GUEST_USER = {
  uid: "dev-guest-demo",
  email: "guest@jodonate.demo",
  displayName: "Guest Demo",
  isAnonymous: false,
} as User;

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  limitedGuest: boolean;
  signInDevBypass: () => void;
  signInGuestBypass: () => void;
  signOutApp: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  limitedGuest: false,
  signInDevBypass: () => {},
  signInGuestBypass: () => {},
  signOutApp: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [devUser, setDevUser] = useState<User | null>(null);
  const [devLimitedGuest, setDevLimitedGuest] = useState(false);
  const [loading, setLoading] = useState(!devAuthActive);

  useEffect(() => {
  if (devAuthActive) {
    setLoading(false);
    return;
  }
  void loadLocale();

  let disabledSignOut = false;
    
    const unsub = onAuthStateChanged(auth, async (u) => {
  if (disabledSignOut) return;
  if (u) {
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists() && snap.data()?.disabled === true) {
  disabledSignOut = true;
  setFirebaseUser(null);
  setLoading(false);
  await signOut(auth);
  disabledSignOut = false; 
  const { crossAlert } = await import("@/lib/cross-alert");
  const { router } = await import("expo-router");
  crossAlert("Account Disabled", "Your account has been disabled. Please contact support.", [
    { text: "OK", onPress: () => router.replace("/(onboarding)") }
  ]);
  return;
}
  }
  setFirebaseUser(u);
  setLoading(false);
});
    return unsub;
  }, []);

  const user = devAuthActive ? devUser : firebaseUser;

  const limitedGuest = devAuthActive
    ? devLimitedGuest
    : !!firebaseUser?.isAnonymous || isDemoGuestEmail(firebaseUser?.email);

  const signInDevBypass = useCallback(() => {
    if (!devAuthActive) return;
    setDevAuthOverride(MOCK_USER);
    setDevUser(MOCK_USER);
    setDevLimitedGuest(false);
  }, []);

  const signInGuestBypass = useCallback(() => {
    if (!devAuthActive) return;
    setDevAuthOverride(MOCK_GUEST_USER);
    setDevUser(MOCK_GUEST_USER);
    setDevLimitedGuest(true);
  }, []);

  const signOutApp = useCallback(async () => {
    if (devAuthActive) {
      setDevAuthOverride(null);
      setDevUser(null);
      setDevLimitedGuest(false);
      await clearUserSessionData();
      return;
    }
    await clearUserSessionData();
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      limitedGuest,
      signInDevBypass,
      signInGuestBypass,
      signOutApp,
    }),
    [user, loading, limitedGuest, signInDevBypass, signInGuestBypass, signOutApp],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}