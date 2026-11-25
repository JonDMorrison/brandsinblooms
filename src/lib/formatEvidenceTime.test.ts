import { describe, expect, it } from "vitest";
import { formatEvidenceTime } from "./formatEvidenceTime";

describe("formatEvidenceTime", () => {
  it("turns an ISO timestamp into a readable time", () => {
    const text = formatEvidenceTime("2026-11-24T18:34:26.411Z");
    expect(text).not.toContain("T18");
    expect(text).toMatch(/2026/);
  });
  it("handles missing and non-date values", () => {
    expect(formatEvidenceTime(null)).toBe("Unavailable");
    expect(formatEvidenceTime("not a date")).toBe("not a date");
  });
});
