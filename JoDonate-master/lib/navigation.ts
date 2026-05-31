import { type Href, type Router } from "expo-router";

/** Avoid GO_BACK console error when there is no screen in the stack. */
export function safeGoBack(router: Router, fallback: Href = "/(private)") {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
