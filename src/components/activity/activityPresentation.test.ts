import { describe, expect, it } from "vitest";
import { formatActivityType, getActivityTitle } from "./activityPresentation";

describe("Activity Center labels", () => {
  it("shows imported timeline rows as human labels", () => {
    // customer_timeline rows reach the feed with title = activity_type.
    expect(getActivityTitle({ title: "purchase", activity_type: "purchase" })).toBe("Purchase");
    expect(getActivityTitle({ title: "email.opened", activity_type: "email.opened" })).toBe("Email opened");
  });

  it("keeps real titles", () => {
    expect(getActivityTitle({ title: "Spring Perennial Sale", activity_type: "purchase" })).toBe(
      "Spring Perennial Sale",
    );
  });

  it("falls back to a readable label for unknown keys", () => {
    expect(formatActivityType("loyalty_join")).toBe("Loyalty Join");
    expect(getActivityTitle({ title: "", activity_type: "" })).toBe("Activity event");
  });
});
