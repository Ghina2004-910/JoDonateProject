import { httpsCallable } from "firebase/functions";
import type { DonationCategory } from "@/lib/donation-categories";
import { normalizeCategoryLabel } from "@/lib/category-keywords";
import { functions } from "@/lib/firebase";

type CategorizeResponse = {
  category: string;
  aiUsed: boolean;
  note?: string;
};

export function normalizeAiCategory(raw: string): DonationCategory | null {
  return normalizeCategoryLabel(raw);
}

export async function categorizeItemFromImage(
  imageUrl: string,
  textHint?: string,
): Promise<{
  category: DonationCategory | null;
  aiUsed: boolean;
  note?: string;
}> {
  const callable = httpsCallable<{ imageUrl: string }, CategorizeResponse>(
    functions,
    "categorizeItemFromImage",
  );
  const { data } = await callable({ imageUrl });

  let category = normalizeCategoryLabel(data.category);
  if (!category && textHint?.trim()) {
    category = normalizeCategoryLabel(textHint) ?? null;
  }

  return {
    category,
    aiUsed: data.aiUsed,
    note: data.note,
  };
}
