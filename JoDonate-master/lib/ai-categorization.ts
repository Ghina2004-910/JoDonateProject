import type { DonationCategory } from "@/lib/donation-categories";
import { normalizeCategoryLabel } from "@/lib/category-keywords";

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
  const response = await fetch("https://jo-donate-project-4eju.vercel.app/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? "";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {}

  let category = normalizeCategoryLabel(parsed.category ?? "");
  if (!category && textHint?.trim()) {
    category = normalizeCategoryLabel(textHint) ?? null;
  }

  return { category, aiUsed: true };
}