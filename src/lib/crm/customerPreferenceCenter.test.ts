import { describe, expect, it } from "vitest";

import {
  normalizeCustomerInterests,
  normalizeCustomerPreferenceSnapshot,
  normalizeGardeningExperience,
} from "./customerPreferenceCenter";

describe("customer preference center normalization", () => {
  it("keeps supported interests once and rejects unrecognized values", () => {
    expect(
      normalizeCustomerInterests([
        "houseplants",
        "unknown",
        "houseplants",
        "workshops",
        42,
      ]),
    ).toEqual(["houseplants", "workshops"]);
  });

  it("accepts only a supported gardening experience", () => {
    expect(normalizeGardeningExperience("intermediate")).toBe("intermediate");
    expect(normalizeGardeningExperience("expert")).toBeNull();
    expect(normalizeGardeningExperience(null)).toBeNull();
  });

  it("normalizes an untrusted API preference payload", () => {
    expect(
      normalizeCustomerPreferenceSnapshot({
        emailOptIn: false,
        interests: ["native_plants", "not-real"],
        gardeningExperience: "beginner",
      }),
    ).toEqual({
      emailOptIn: false,
      interests: ["native_plants"],
      gardeningExperience: "beginner",
    });

    expect(normalizeCustomerPreferenceSnapshot("invalid")).toEqual({
      emailOptIn: null,
      interests: [],
      gardeningExperience: null,
    });
  });
});
