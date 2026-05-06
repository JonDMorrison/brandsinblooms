import { describe, expect, it } from "vitest";
import {
  clampRolloutPercent,
  hashVisitorToBucket,
  resolveHomepageLaunchVariant,
} from "./homepageLaunchFlags";

const findVisitorForBucket = (predicate: (bucket: number) => boolean) => {
  for (let index = 0; index < 1000; index += 1) {
    const visitorId = `visitor-${index}`;
    if (predicate(hashVisitorToBucket(visitorId))) {
      return visitorId;
    }
  }

  throw new Error("No deterministic visitor bucket found");
};

describe("homepageLaunchFlags", () => {
  it("clamps rollout percentages to a deploy-safe range", () => {
    expect(clampRolloutPercent(-10)).toBe(0);
    expect(clampRolloutPercent(10)).toBe(10);
    expect(clampRolloutPercent("50")).toBe(50);
    expect(clampRolloutPercent(120)).toBe(100);
    expect(clampRolloutPercent("not-a-number")).toBe(100);
  });

  it("allows a server-controlled rollback to the legacy homepage", () => {
    expect(
      resolveHomepageLaunchVariant({
        config: { enabled: false, rolloutPercent: 100 },
        visitorId: "visitor-1",
      }),
    ).toBe("legacy");
    expect(
      resolveHomepageLaunchVariant({
        config: { variant: "legacy", rolloutPercent: 100 },
        visitorId: "visitor-1",
      }),
    ).toBe("legacy");
  });

  it("buckets visitors deterministically for staged rollout", () => {
    const includedVisitor = findVisitorForBucket((bucket) => bucket < 10);
    const excludedVisitor = findVisitorForBucket((bucket) => bucket >= 10);

    expect(
      resolveHomepageLaunchVariant({
        config: { enabled: true, rolloutPercent: 10 },
        visitorId: includedVisitor,
      }),
    ).toBe("new");
    expect(
      resolveHomepageLaunchVariant({
        config: { enabled: true, rolloutPercent: 10 },
        visitorId: excludedVisitor,
      }),
    ).toBe("legacy");
  });
});
