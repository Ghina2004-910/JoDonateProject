import * as Linking from "expo-linking";
import {
  sendEmailVerification,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";

export function isAnonymousUser(user: User | null | undefined): boolean {
  return !!user?.isAnonymous;
}

export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous) return true;
  return user.emailVerified === true;
}

function verificationActionSettings(): ActionCodeSettings {
  return {
    url: Linking.createURL("/verify-email"),
    handleCodeInApp: false,
  };
}

export async function sendVerificationEmail(user: User): Promise<void> {
  if (user.isAnonymous) return;
  await sendEmailVerification(user, verificationActionSettings());
}

export function requireVerifiedMessage(): string {
  return "Please verify your email before continuing. Check your inbox for the verification link.";
}
