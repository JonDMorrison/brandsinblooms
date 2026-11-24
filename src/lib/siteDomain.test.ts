import { describe, expect, it } from "vitest";
import { pickVerifiedSiteDomain } from "./siteDomain";

describe("connected website custom domain", () => {
  it("hides pending custom domains (all 5 in production are pending)", () => {
    expect(
      pickVerifiedSiteDomain([
        { domain: "shop.example.ca", type: "custom", status: "pending", verified_at: null },
      ]),
    ).toBeNull();
  });

  it("shows an active, verified custom domain, preferring the primary", () => {
    expect(
      pickVerifiedSiteDomain([
        { domain: "old.example.ca", type: "custom", status: "active", verified_at: "2026-01-01T00:00:00Z" },
        { domain: "WWW.Northfield.ca", type: "custom", status: "active", verified_at: "2025-06-01T00:00:00Z", is_primary: true },
      ]),
    ).toBe("www.northfield.ca");
  });
});
