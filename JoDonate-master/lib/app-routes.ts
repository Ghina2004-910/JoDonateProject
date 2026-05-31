import type { Href } from "expo-router";

export const ROUTES = {
  verifyEmail: "/(onboarding)/verify-email" as Href,
  admin: "/(private)/admin" as Href,
  committeeReviews: "/(private)/committee/reviews" as Href,
  addItem: "/(private)/add-item" as Href,
  myItems: "/(private)/my-items" as Href,
  donations: "/(private)/donations" as Href,
  home: "/(private)" as Href,
  favorites: "/(private)/favorites" as Href,
} as const;
