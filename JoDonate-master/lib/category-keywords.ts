import { DONATION_CATEGORIES, type DonationCategory } from "@/lib/donation-categories";

/** Keyword lists for text-based and fuzzy AI category matching. */
export const CATEGORY_KEYWORDS: { category: DonationCategory; words: string[] }[] = [
  {
    category: "Food & Grocery",
    words: ["food", "meal", "grocery", "bread", "rice", "fruit", "vegetable", "pantry", "snack", "طعام", "أكل", "بقالة"],
  },
  {
    category: "Clothes & Fashion",
    words: ["cloth", "clothing", "shirt", "dress", "shoe", "jacket", "fashion", "wear", "ملابس", "ثوب", "حذاء"],
  },
  {
    category: "Services",
    words: ["service", "repair", "fix", "maintenance", "consult", "help", "خدمة", "صيانة", "إصلاح"],
  },
  {
    category: "Company Equipment",
    words: ["office", "desk", "chair", "printer", "equipment", "workstation", "industrial", "tool", "معدات", "مكتب"],
  },
  {
    category: "Games",
    words: ["game", "gaming", "console", "playstation", "xbox", "nintendo", "puzzle", "board", "toy", "لعبة", "ألعاب"],
  },
  {
    category: "Electronics",
    words: ["phone", "laptop", "tv", "electronic", "tablet", "computer", "camera", "speaker", "كمبيوتر", "جوال", "إلكترون"],
  },
  {
    category: "Sports & Fitness",
    words: ["sport", "gym", "ball", "fitness", "exercise", "bike", "bicycle", "yoga", "رياضة", "لياقة"],
  },
  {
    category: "Education & Training",
    words: ["course", "tutor", "education", "training", "school", "study", "lesson", "تعليم", "درس", "تدريب"],
  },
  {
    category: "Pets & Accessories",
    words: ["pet", "dog", "cat", "animal", "aquarium", "leash", "cage", "حيوان", "قط", "كلب"],
  },
  {
    category: "Beauty & Health",
    words: ["beauty", "cream", "health", "medicine", "cosmetic", "skincare", "vitamin", "دواء", "عناية", "صحة"],
  },
  {
    category: "Books",
    words: ["book", "novel", "textbook", "magazine", "library", "reading", "كتاب", "رواية", "دراسة"],
  },
];

/** Short aliases returned by AI models that map to app categories. */
export const CATEGORY_ALIASES: Record<string, DonationCategory> = {
  food: "Food & Grocery",
  grocery: "Food & Grocery",
  groceries: "Food & Grocery",
  clothes: "Clothes & Fashion",
  clothing: "Clothes & Fashion",
  fashion: "Clothes & Fashion",
  apparel: "Clothes & Fashion",
  services: "Services",
  service: "Services",
  equipment: "Company Equipment",
  office: "Company Equipment",
  furniture: "Company Equipment",
  games: "Games",
  gaming: "Games",
  game: "Games",
  electronics: "Electronics",
  electronic: "Electronics",
  sports: "Sports & Fitness",
  fitness: "Sports & Fitness",
  education: "Education & Training",
  training: "Education & Training",
  pets: "Pets & Accessories",
  pet: "Pets & Accessories",
  beauty: "Beauty & Health",
  health: "Beauty & Health",
  books: "Books",
  book: "Books",
  accessories: "Beauty & Health",
  plants: "Food & Grocery",
};

export function scoreCategoryFromText(text: string): DonationCategory | null {
  const lower = text.toLowerCase();
  let best: { category: DonationCategory; score: number } | null = null;

  for (const row of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const w of row.words) {
      const word = w.toLowerCase();
      if (lower.includes(word)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: row.category, score };
    }
  }

  if (!best) return null;
  return DONATION_CATEGORIES.includes(best.category) ? best.category : null;
}

export function normalizeCategoryLabel(raw: string): DonationCategory | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if ((DONATION_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as DonationCategory;
  }

  const lower = trimmed.toLowerCase();
  const exact = DONATION_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  const alias = CATEGORY_ALIASES[lower];
  if (alias) return alias;

  for (const [key, category] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(key) || key.includes(lower)) return category;
  }

  for (const row of CATEGORY_KEYWORDS) {
    const catLower = row.category.toLowerCase();
    if (lower.includes(catLower) || catLower.includes(lower)) return row.category;
  }

  return scoreCategoryFromText(trimmed);
}
