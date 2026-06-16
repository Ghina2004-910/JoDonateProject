import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { auth, db } from "@/lib/firebase";
import type { UserRole } from "@/lib/roles";
import { DEFAULT_COMMITTEE_ID } from "@/lib/committees";

/** Shared demo password — create these users once in Firebase or auto-create on first tap. */
export const DEMO_PASSWORD = "Demo1234!";

export const DEMO_GUEST_EMAIL = "guest@jodonate.demo";

export type DemoAccountKey = "admin" | "committee" | "donor" | "receiver" | "guest";

export type DemoAccount = {
  key: DemoAccountKey;
  label: string;
  email: string;
  password: string;
  role: UserRole;
  /** Guest can browse only (no add / request / chat). */
  browseOnly?: boolean;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "admin",
    label: "Admin",
    email: "admin@jodonate.demo",
    password: DEMO_PASSWORD,
    role: "admin",
  },
  {
    key: "committee",
    label: "Aid Committee",
    email: "committee@jodonate.demo",
    password: DEMO_PASSWORD,
    role: "committee",
  },
  {
    key: "donor",
    label: "Donor",
    email: "donor@jodonate.demo",
    password: DEMO_PASSWORD,
    role: "user",
  },
  {
    key: "receiver",
    label: "Receiver",
    email: "receiver@jodonate.demo",
    password: DEMO_PASSWORD,
    role: "user",
  },
  
];

export function isDemoLoginEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_DEMO_LOGIN === "true";
}

export function isDemoGuestEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === DEMO_GUEST_EMAIL;
}

async function upsertUserProfile(
  uid: string,
  account: DemoAccount,
) {
  await setDoc(
    doc(db, "users", uid),
    {
      name: account.label,
      email: account.email,
      role: account.role,
      demoAccount: account.key,
      browseOnly: account.browseOnly === true,
      updatedAt: serverTimestamp(),
      ...(account.role === "committee"
        ? { committeeId: DEFAULT_COMMITTEE_ID }
        : {}),
      ...(account.key === "donor" ? { demoPersona: "donor" } : {}),
      ...(account.key === "receiver" ? { demoPersona: "receiver" } : {}),
    },
    { merge: true },
  );

  if (account.role === "committee") {
    await setDoc(
      doc(db, "committeeMembers", `${uid}_${DEFAULT_COMMITTEE_ID}`),
      {
        userId: uid,
        committeeId: DEFAULT_COMMITTEE_ID,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function signInDemoAccount(account: DemoAccount): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, account.email, account.password);
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          account.email,
          account.password,
        );
        await upsertUserProfile(cred.user.uid, account);
        return;
      } catch (createErr: unknown) {
        throw new Error(firebaseAuthErrorMessage(createErr, "Could not create demo account."));
      }
    }
    throw new Error(firebaseAuthErrorMessage(e, "Demo sign-in failed."));
  }

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign-in succeeded but no user session.");
  await upsertUserProfile(uid, account);
}