import { describe, expect, it } from "vitest";
import {
  buildSegmentSummary,
  missingRuleData,
} from "../../supabase/functions/bloom-assist/entity-prefetch";

const lapsed = {
  logic: "AND",
  rules: [
    { field: "last_purchase_date", operator: "older_than_days", value: 90 },
    { field: "total_spent", operator: ">", value: 0 },
  ],
};

describe("Bloom explains why a built-in group is empty", () => {
  it("names the purchase data no customer has", () => {
    expect(missingRuleData(lapsed, new Set())).toEqual([
      "purchase dates",
      "lifetime spending totals",
    ]);
    expect(missingRuleData(lapsed, new Set(["last_purchase_date", "total_spent"]))).toEqual([]);
    expect(missingRuleData({ rules: [{ field: "tags", operator: "contains", value: "vip" }] }, new Set())).toEqual([]);
  });

  it("tells Bloom the group is empty for lack of data, not lack of customers", () => {
    const summary = buildSegmentSummary(
      { name: "Lapsed Customers", is_system_segment: true, status: "active", customer_count: 0 },
      "segment-id",
      ["purchase dates"],
    );
    expect(summary.summaryText).toContain("no customer in this company has purchase dates on file");
    expect(summary.summaryText).toContain("do not say no customers meet the criteria");
  });

  it("says nothing extra when the data exists", () => {
    const summary = buildSegmentSummary(
      { name: "Lapsed Customers", is_system_segment: true, status: "active", customer_count: 0 },
      "segment-id",
    );
    expect(summary.summaryText).not.toContain("empty because");
  });
});
