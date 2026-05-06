import { describe, expect, it } from "vitest";
import {
  RECENCY_WINDOW_MS,
  isWithinRecencyWindow,
} from "../publishItemRecency";

describe("publishItemRecency", () => {
  it("RECENCY_WINDOW_MS is 30 days expressed in milliseconds", () => {
    expect(RECENCY_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  describe("isWithinRecencyWindow", () => {
    const NOW = new Date("2026-05-05T12:00:00Z").getTime();

    it("returns true for a timestamp 1 day old", () => {
      const oneDayAgo = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
      expect(isWithinRecencyWindow(oneDayAgo, NOW)).toBe(true);
    });

    it("returns true at exactly 30 days old (boundary inclusive)", () => {
      const exactly30 = new Date(NOW - RECENCY_WINDOW_MS).toISOString();
      expect(isWithinRecencyWindow(exactly30, NOW)).toBe(true);
    });

    it("returns false at 31 days old", () => {
      const thirtyOne = new Date(
        NOW - RECENCY_WINDOW_MS - 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(isWithinRecencyWindow(thirtyOne, NOW)).toBe(false);
    });

    it("returns false for the Maple Park 6-month-stale Halloween content", () => {
      // Real example from the audit: Halloween content_tasks created on
      // 2025-10-30 still surfacing as "ready to post" in May 2026.
      const oct30 = new Date("2025-10-30T13:08:00Z").toISOString();
      expect(isWithinRecencyWindow(oct30, NOW)).toBe(false);
    });

    it("returns true (do-not-hide) for null/undefined/empty timestamps", () => {
      expect(isWithinRecencyWindow(null, NOW)).toBe(true);
      expect(isWithinRecencyWindow(undefined, NOW)).toBe(true);
      expect(isWithinRecencyWindow("", NOW)).toBe(true);
    });

    it("returns true (do-not-hide) for unparseable timestamps", () => {
      expect(isWithinRecencyWindow("not-a-date", NOW)).toBe(true);
      expect(isWithinRecencyWindow("2026-13-99", NOW)).toBe(true);
    });

    it("respects a caller-supplied custom window", () => {
      const sevenDaysAgo = new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fiveDayWindow = 5 * 24 * 60 * 60 * 1000;
      expect(isWithinRecencyWindow(sevenDaysAgo, NOW, fiveDayWindow)).toBe(false);
      const thirtyDayWindow = RECENCY_WINDOW_MS;
      expect(isWithinRecencyWindow(sevenDaysAgo, NOW, thirtyDayWindow)).toBe(true);
    });
  });
});
