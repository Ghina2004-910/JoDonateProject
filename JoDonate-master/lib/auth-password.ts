import * as Linking from "expo-linking";
import { sendPasswordResetEmail, type ActionCodeSettings } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function sendPasswordResetToEmail(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Enter your email address."), { code: "auth/missing-email" });
  }

  const actionCodeSettings: ActionCodeSettings = {
    url: Linking.createURL("/login"),
    handleCodeInApp: false,
  };

  await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
}
