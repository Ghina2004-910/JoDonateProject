import type { DonationCategory } from "@/lib/donation-categories";
import { scoreCategoryFromText } from "@/lib/category-keywords";

export function suggestCategoryFromText(title: string, description: string): DonationCategory | null {
  return scoreCategoryFromText(`${title} ${description}`);
}
