import { doc, getDoc } from "firebase/firestore";
import type { Href } from "expo-router";
import { db } from "@/lib/firebase";
import { ROUTES } from "@/lib/app-routes";

let pendingRoute: Href | null = null;

export function setPendingRoute(route: Href | null) {
  pendingRoute = route;
}

export function consumePendingRoute(): Href | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

export function hasPendingRoute(): boolean {
  return pendingRoute !== null;
}

export async function getRouteForUser(uid: string): Promise<Href> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return ROUTES.home;
    const data = snap.data() as {
      role?: string;
      browseOnly?: boolean;
      demoPersona?: string;
    };
    const role = data.role ?? "user";

    if (role === "admin") return ROUTES.admin;
    if (role === "committee") return ROUTES.committeeReviews;
    if (data.browseOnly) return ROUTES.home;
    if (data.demoPersona === "donor") return ROUTES.myItems;
    if (data.demoPersona === "receiver") return ROUTES.donations;

    return ROUTES.home;
  } catch {
    return ROUTES.home;
  }
}
