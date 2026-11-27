import { describe, expect, it } from "vitest";
import {
  summarizeReachability,
  toAudienceHealth,
} from "./useTenantAudienceHealth";

describe("reachable customers card copy", () => {
  it("explains Northfield's 0 of 9,500 from the reachability buckets", () => {
    // email_reachability_summary for Northfield on production, 2026-11-26.
    const health = toAudienceHealth([
      { total: 9500, reachable: 0, waiting: 0, stopped: 1900, unsendable: 7600, asked_to_stop: 0, never_opted_in: 1900 },
    ]);
    expect(summarizeReachability(health)).toEqual({
      value: "0",
      description:
        "0 of 9,500 reachable. 7,600 can't receive email (invalid, bounced, suppressed or test addresses); 1,900 never opted in.",
      explained: true,
    });
  });

  it("leaves a mostly reachable list unchanged", () => {
    // Brands in Blooms on production, 2026-11-26: 1,818 of 2,273 reachable.
    const health = toAudienceHealth([
      { total: 2273, reachable: 1818, waiting: 8, stopped: 189, unsendable: 258, asked_to_stop: 184, never_opted_in: 5 },
    ]);
    expect(summarizeReachability(health)).toEqual({
      value: "1,818",
      description: "Confirmed and not suppressed for email",
      explained: false,
    });
  });

  it("keeps the standard caption for an empty list", () => {
    const health = toAudienceHealth([
      { total: 0, reachable: 0, waiting: 0, stopped: 0, unsendable: 0, asked_to_stop: 0, never_opted_in: 0 },
    ]);
    expect(summarizeReachability(health).explained).toBe(false);
  });
});
