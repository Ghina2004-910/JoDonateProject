export function firebaseAuthErrorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try logging in.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Password is too weak. Use at least 6 characters (8+ recommended).";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/missing-email":
      return "Enter your email address.";
    case "auth/operation-not-allowed":
      return "Email sign-up is disabled in Firebase. Enable Email/Password under Authentication → Sign-in method.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase API key is invalid. Check lib/firebase.ts and your Firebase project settings.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/user-not-found":
      return "No account with this email. Sign up first or use a demo role button.";
    case "auth/missing-continue-uri":
    case "auth/invalid-continue-uri":
      return "Password reset link could not be generated. Try again from Settings while signed in.";
    case "auth/admin-restricted-operation":
      return "This sign-in method is disabled. Enable Email/Password in Firebase Console.";
    case "auth/requires-recent-login":
      return "For security, sign in again or enter your current password, then retry.";
    default:
      if (__DEV__ && message) return `${fallback} (${message})`;
      return fallback;
  }
}
