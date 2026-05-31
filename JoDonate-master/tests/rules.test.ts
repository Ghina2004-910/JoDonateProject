import { canMarkDonated, canRequestItem } from "../lib/rules";

describe("Mark Donated Business Rule", () => {
  it("returns true when status is accepted", () => {
    expect(canMarkDonated("accepted")).toBe(true);
  });

  it("returns false when status is available", () => {
    expect(canMarkDonated("available")).toBe(false);
  });

  it("returns false when status is donated", () => {
    expect(canMarkDonated("donated")).toBe(false);
  });
});

describe("Request item status", () => {
  it("allows request when available or requested", () => {
    expect(canRequestItem("available")).toBe(true);
    expect(canRequestItem("requested")).toBe(true);
    expect(canRequestItem("accepted")).toBe(false);
  });
});
