jest.mock("expo-location", () => ({}));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));

import { distanceKm, withinRadiusKm } from "../lib/location-filter";

describe("distanceKm", () => {
  it("returns zero for identical coordinates", () => {
    const point = { latitude: 31.95, longitude: 35.91 };
    expect(distanceKm(point, point)).toBe(0);
  });

  it("computes distance between two points", () => {
    const amman = { latitude: 31.9539, longitude: 35.9106 };
    const zarqa = { latitude: 32.0728, longitude: 36.088 };
    const km = distanceKm(amman, zarqa);
    expect(km).toBeGreaterThan(15);
    expect(km).toBeLessThan(35);
  });
});

describe("withinRadiusKm", () => {
  it("returns false when item has no coordinates", () => {
    const user = { latitude: 31.95, longitude: 35.91 };
    expect(withinRadiusKm(user, {}, 10)).toBe(false);
  });

  it("returns true when item is inside radius", () => {
    const user = { latitude: 31.9539, longitude: 35.9106 };
    const nearby = { latitude: 31.96, longitude: 35.92 };
    expect(withinRadiusKm(user, nearby, 5)).toBe(true);
  });
});
