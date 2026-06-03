import { jest, expect, test, describe } from '@jest/globals';

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: { glyphMap: {} },
}));

import { canRequestItem, canMarkDonated } from "../lib/rules";
import { distanceKm, withinRadiusKm } from "../lib/location-filter";
import { suggestCategoryFromText } from "../lib/category-suggest";
import { DONATION_CATEGORIES, categoryFormKind } from "../lib/donation-categories";
// Use Jest's test/describe (do not import node:test which conflicts with Jest)

// ─────────────────────────────────────────────
// F7 – Item Status Rules
// ─────────────────────────────────────────────
describe("canRequestItem – Item Status Rules", () => {
  test("returns true when item is available", () => {
    expect(canRequestItem("available")).toBe(true);
  });

  test("returns true when item is requested", () => {
    expect(canRequestItem("requested")).toBe(true);
  });

  test("returns false when item is accepted", () => {
    expect(canRequestItem("accepted")).toBe(false);
  });

  test("returns false when item is donated", () => {
    expect(canRequestItem("donated")).toBe(false);
  });

  test("returns false for unknown status", () => {
    expect(canRequestItem("unknown")).toBe(false);
    expect(canRequestItem("")).toBe(false);
  });
});

describe("canMarkDonated – Donated Status Rule", () => {
  test("returns true only when status is accepted", () => {
    expect(Boolean(canMarkDonated("accepted"))).toBe(true);
  });

  test("returns false when status is available", () => {
    expect(canMarkDonated("available")).toBe(false);
  });

  test("returns false when status is requested", () => {
    expect(canMarkDonated("requested")).toBe(false);
  });

  test("returns false when status is already donated", () => {
    expect(canMarkDonated("donated")).toBe(false);
  });

  test("returns false for unknown status", () => {
    expect(canMarkDonated("")).toBe(false);
    expect(canMarkDonated("pending")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// F3 – GPS Location Filter (Haversine)
// ─────────────────────────────────────────────
describe("distanceKm – Haversine Calculation", () => {
  test("distance between same point is 0", () => {
    const coord = { latitude: 31.9539, longitude: 35.9106 };
    expect(distanceKm(coord, coord)).toBeCloseTo(0, 1);
  });

  test("distance between Amman and Irbid is approximately 68 km", () => {
    const amman = { latitude: 31.9539, longitude: 35.9106 };
    const irbid = { latitude: 32.5556, longitude: 35.85 };
    expect(distanceKm(amman, irbid)).toBeCloseTo(68, -1);
  });

  test("distance between Amman and Aqaba is greater than 250 km", () => {
    const amman = { latitude: 31.9539, longitude: 35.9106 };
    const aqaba = { latitude: 29.5321, longitude: 35.0064 };
    expect(distanceKm(amman, aqaba)).toBeGreaterThan(250);
  });

  test("distance is symmetric — A to B equals B to A", () => {
    const a = { latitude: 31.9539, longitude: 35.9106 };
    const b = { latitude: 32.5556, longitude: 35.85 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 5);
  });
});

describe("withinRadiusKm – GPS Proximity Filter", () => {
  const user = { latitude: 31.9539, longitude: 35.9106 };

  test("returns true when item is within radius", () => {
    const nearbyItem = { latitude: 31.97, longitude: 35.93 };
    expect(withinRadiusKm(user, nearbyItem, 10)).toBe(true);
  });

  test("returns false when item is outside radius", () => {
    const farItem = { latitude: 32.5556, longitude: 35.85 };
    expect(withinRadiusKm(user, farItem, 10)).toBe(false);
  });

  test("returns false when item has no coordinates", () => {
    expect(withinRadiusKm(user, {}, 10)).toBe(false);
    expect(withinRadiusKm(user, { latitude: 31.97 }, 10)).toBe(false);
    expect(withinRadiusKm(user, { longitude: 35.93 }, 10)).toBe(false);
  });

  test("returns true when item is exactly on the boundary", () => {
    const boundaryItem = { latitude: 32.0438, longitude: 35.9106 };
    const dist = distanceKm(user, boundaryItem);
    expect(withinRadiusKm(user, boundaryItem, dist)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// F12 – AI Category Suggestion (Keyword Fallback)
// ─────────────────────────────────────────────
describe("suggestCategoryFromText – English Keywords", () => {
  test("detects Books", () => {
    expect(suggestCategoryFromText("Old book", "")).toBe("Books");
  });

  test("detects Electronics", () => {
    expect(suggestCategoryFromText("Laptop", "good condition")).toBe("Electronics");
  });

  test("detects Clothes & Fashion", () => {
    expect(suggestCategoryFromText("shirt", "barely worn dress")).toBe("Clothes & Fashion");
  });

  test("detects Food & Grocery", () => {
    expect(suggestCategoryFromText("Fresh bread", "homemade food")).toBe("Food & Grocery");
  });

  test("detects Sports & Fitness", () => {
    expect(suggestCategoryFromText("Gym equipment", "sport ball")).toBe("Sports & Fitness");
  });

  test("detects Beauty & Health", () => {
    expect(suggestCategoryFromText("Face cream", "beauty product")).toBe("Beauty & Health");
  });

  test("detects Pets & Accessories", () => {
    expect(suggestCategoryFromText("Cat bed", "for my pet dog")).toBe("Pets & Accessories");
  });

  test("detects Education & Training", () => {
    expect(suggestCategoryFromText("Online course", "education material")).toBe("Education & Training");
  });

  test("detects Services", () => {
    expect(suggestCategoryFromText("Repair service", "fix anything")).toBe("Services");
  });
});

describe("suggestCategoryFromText – Arabic Keywords", () => {
  test("detects Books from كتاب", () => {
    expect(suggestCategoryFromText("كتاب قديم", "")).toBe("Books");
  });

  test("detects Clothes from ملابس", () => {
    expect(suggestCategoryFromText("ملابس أطفال", "")).toBe("Clothes & Fashion");
  });

  test("detects Food from طعام", () => {
    expect(suggestCategoryFromText("طعام مجاني", "")).toBe("Food & Grocery");
  });

  test("detects Electronics from جوال", () => {
    expect(suggestCategoryFromText("جوال قديم", "")).toBe("Electronics");
  });
});

describe("suggestCategoryFromText – Edge Cases", () => {
  test("returns null for empty input", () => {
    expect(suggestCategoryFromText("", "")).toBeNull();
  });

  test("returns null for unrelated text", () => {
    expect(suggestCategoryFromText("xyz abc", "123 qqq")).toBeNull();
  });

  test("picks highest-score category when multiple keywords match", () => {
    expect(suggestCategoryFromText("book novel", "")).toBe("Books");
  });
});

// ─────────────────────────────────────────────
// F2 – Donation Categories Validation
// ─────────────────────────────────────────────
describe("DONATION_CATEGORIES – Category List", () => {
  test("contains exactly 11 categories", () => {
    expect(DONATION_CATEGORIES.length).toBe(11);
  });

  test("contains all expected categories", () => {
    const expected = [
      "Food & Grocery", "Clothes & Fashion", "Services",
      "Company Equipment", "Games", "Electronics",
      "Sports & Fitness", "Education & Training",
      "Pets & Accessories", "Beauty & Health", "Books",
    ];
    expected.forEach(cat => expect(DONATION_CATEGORIES).toContain(cat));
  });

  test("has no duplicate categories", () => {
    const unique = new Set(DONATION_CATEGORIES);
    expect(unique.size).toBe(DONATION_CATEGORIES.length);
  });
});

describe("categoryFormKind – Category Mapping", () => {
  test("maps Food & Grocery to food", () => {
    expect(categoryFormKind("Food & Grocery")).toBe("food");
  });

  test("maps Clothes & Fashion to clothes", () => {
    expect(categoryFormKind("Clothes & Fashion")).toBe("clothes");
  });

  test("maps Books to books", () => {
    expect(categoryFormKind("Books")).toBe("books");
  });

  test("maps Electronics to electronics", () => {
    expect(categoryFormKind("Electronics")).toBe("electronics");
  });

  test("maps Beauty & Health to beauty", () => {
    expect(categoryFormKind("Beauty & Health")).toBe("beauty");
  });

  test("maps Services to services", () => {
    expect(categoryFormKind("Services")).toBe("services");
  });

  test("maps Education & Training to education", () => {
    expect(categoryFormKind("Education & Training")).toBe("education");
  });

  test("maps Sports & Fitness to sports", () => {
    expect(categoryFormKind("Sports & Fitness")).toBe("sports");
  });

  test("maps Pets & Accessories to pets", () => {
    expect(categoryFormKind("Pets & Accessories")).toBe("pets");
  });

  test("maps Games and Company Equipment to other", () => {
    expect(categoryFormKind("Games")).toBe("other");
    expect(categoryFormKind("Company Equipment")).toBe("other");
  });

  test("maps unknown string to other", () => {
    expect(categoryFormKind("")).toBe("other");
  });
});


