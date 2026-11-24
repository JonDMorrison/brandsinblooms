import { describe, expect, it } from "vitest";
import { scoreListHealth } from "./listHealthData";

const clean = { bounceRate: 0, complaintRate: 0, healthStatus: "healthy" as const };

describe("list health factors in reachability", () => {
  it("never shows 100% healthy with 0 reachable contacts (Northfield: 0 of 9,500)", () => {
    const result = scoreListHealth({ ...clean, reachable: 0, total: 9500 });
    expect(result.score).toBe(0);
    expect(result.status).toBe("critical");
    expect(result.label).toBe("No reachable contacts");
  });

  it("caps the score by the reachable share", () => {
    const result = scoreListHealth({ ...clean, reachable: 300, total: 1000 });
    expect(result.score).toBe(30);
    expect(result.status).toBe("warning");
  });

  it("keeps deliverability problems when reachability is fine", () => {
    const result = scoreListHealth({
      bounceRate: 6,
      complaintRate: 0,
      healthStatus: "critical",
      reachable: 900,
      total: 1000,
    });
    expect(result.score).toBe(40);
    expect(result.status).toBe("critical");
  });

  it("says so when reachability is unknown instead of claiming healthy", () => {
    const result = scoreListHealth({ ...clean, reachable: null, total: null });
    expect(result.status).toBe("unknown");
  });
});
