import { Ionicons } from "@expo/vector-icons";

type IonGlyph = keyof typeof Ionicons.glyphMap;

export const DONATION_CATEGORIES = [
  "Food & Grocery",
  "Clothes & Fashion",
  "Services",
  "Company Equipment",
  "Games",
  "Electronics",
  "Sports & Fitness",
  "Education & Training",
  "Pets & Accessories",
  "Beauty & Health",
  "Books",
] as const;

export type DonationCategory = (typeof DONATION_CATEGORIES)[number];

export const CATEGORY_ICONS: Record<DonationCategory, IonGlyph> = {
  "Food & Grocery": "fast-food-outline",
  "Clothes & Fashion": "shirt-outline",
  Services: "construct-outline",
  "Company Equipment": "business-outline",
  Games: "game-controller-outline",
  Electronics: "phone-portrait-outline",
  "Sports & Fitness": "barbell-outline",
  "Education & Training": "school-outline",
  "Pets & Accessories": "paw-outline",
  "Beauty & Health": "sparkles-outline",
  Books: "book-outline",
};

export const JORDAN_CITIES = [
  "Amman",
  "Zarqa",
  "Irbid",
  "Mafraq",
  "Ajlun",
  "Jerash",
  "Salt",
  "Madaba",
  "Karak",
  "Tafilah",
  "Aqaba",
  "Ma'an",
  "Dead Sea area",
] as const;

export type CategoryFormKind =
  | "food"
  | "clothes"
  | "books"
  | "beauty"
  | "electronics"
  | "services"
  | "education"
  | "sports"
  | "pets"
  | "other";

export function categoryFormKind(cat: string): CategoryFormKind {
  if (cat === "Food & Grocery") return "food";
  if (cat === "Clothes & Fashion") return "clothes";
  if (cat === "Books") return "books";
  if (cat === "Beauty & Health") return "beauty";
  if (cat === "Electronics") return "electronics";
  if (cat === "Services") return "services";
  if (cat === "Education & Training") return "education";
  if (cat === "Sports & Fitness") return "sports";
  if (cat === "Pets & Accessories") return "pets";
  return "other";
}
