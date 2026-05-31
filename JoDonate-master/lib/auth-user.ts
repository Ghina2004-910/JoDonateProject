import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SKIP_FIREBASE_AUTH } from "@/lib/dev-auth";

let devOverride: User | null = null;


export function setDevAuthOverride(user: User | null) {
  devOverride = user;
}


export function getAuthUser(): User | null {
  if (__DEV__ && SKIP_FIREBASE_AUTH) return devOverride;
  return auth.currentUser;
}
