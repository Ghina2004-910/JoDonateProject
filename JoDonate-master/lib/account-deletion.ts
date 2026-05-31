import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { deleteUserFirestoreData } from "@/lib/account-cleanup";
import { firebaseAuthErrorMessage } from "@/lib/firebase-auth-errors";
import { auth } from "@/lib/firebase";

export class AccountDeletionError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AccountDeletionError";
    this.code = code;
  }
}

function authErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

export async function deleteAccountPermanently(currentPassword?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AccountDeletionError("You are not signed in.", "auth/no-user");
  }

  const email = user.email;
  if (!email) {
    throw new AccountDeletionError(
      "This account has no email address. Contact support to delete it.",
      "auth/no-email",
    );
  }

  if (currentPassword?.trim()) {
    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(email, currentPassword.trim()),
      );
    } catch (e: unknown) {
      const code = authErrorCode(e);
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        throw new AccountDeletionError("Current password is incorrect.", code);
      }
      throw new AccountDeletionError(
        firebaseAuthErrorMessage(e, "Could not verify your password."),
        code,
      );
    }
  }

  await deleteUserFirestoreData(user.uid);

  try {
    await deleteUser(user);
  } catch (e: unknown) {
    const code = authErrorCode(e);
    if (code === "auth/requires-recent-login") {
      throw new AccountDeletionError(
        "For security, enter your current password and try again.",
        code,
      );
    }
    throw new AccountDeletionError(
      firebaseAuthErrorMessage(e, "Could not delete your account."),
      code,
    );
  }
}

export function accountDeletionErrorMessage(error: unknown): string {
  if (error instanceof AccountDeletionError) return error.message;
  return firebaseAuthErrorMessage(error, "Could not delete account.");
}

export function accountDeletionNeedsPassword(error: unknown): boolean {
  if (error instanceof AccountDeletionError) {
    return error.code === "auth/requires-recent-login";
  }
  return authErrorCode(error) === "auth/requires-recent-login";
}
