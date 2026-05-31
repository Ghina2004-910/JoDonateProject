import type { Href } from "expo-router";

export function categoryScreenHref(categoryName: string): Href {
  const encoded = encodeURIComponent(categoryName);
  return `/category/${encoded}` as Href;
}

export function decodeCategoryRouteParam(raw: string | undefined): string {
  if (!raw) return "";
  try {
    let s = decodeURIComponent(String(raw));
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      try {
        s = decodeURIComponent(s);
      } catch {
      }
    }
    return s.trim();
  } catch {
    return String(raw).trim();
  }
}
