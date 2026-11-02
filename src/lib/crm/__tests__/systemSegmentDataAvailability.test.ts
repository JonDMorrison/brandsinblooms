import { describe, expect, it } from "vitest";

import { SYSTEM_SEGMENTS } from "@/config/segmentDefinitions";
import {
  MISSING_SEGMENT_DATA_MESSAGES,
  getMissingDataExplanation,
  getRequiredDataFields,
  getSystemSegmentDefinition,
  type SegmentDataAvailability,
} from "@/lib/crm/systemSegmentDataAvailability";

const NONE: SegmentDataAvailability = {
  first_purchase_date: false,
  last_purchase_date: false,
  total_spent: false,
  pos_order_count: false,
  tags: false,
  is_perks_member: false,
};

const ALL: SegmentDataAvailability = {
  first_purchase_date: true,
  last_purchase_date: true,
  total_spent: true,
  pos_order_count: true,
  tags: true,
  is_perks_member: true,
};

describe("getRequiredDataFields", () => {
  it.each([
    ["New Customers", ["first_purchase_date"]],
    ["Lapsed Customers", ["last_purchase_date"]],
    ["High-Value Customers", ["total_spent"]],
    ["Frequent Buyers", ["pos_order_count"]],
    ["Loyalty Members", ["tags"]],
    ["Seasonal Shoppers", ["tags"]],
    ["Perks Members", ["is_perks_member"]],
  ])("maps %s to the field its rule reads", (name, fields) => {
    const definition = getSystemSegmentDefinition(name);
    expect(definition).toBeDefined();
    expect(definition && getRequiredDataFields(definition)).toEqual(fields);
  });

  it("covers every built-in group", () => {
    for (const definition of SYSTEM_SEGMENTS) {
      expect(getRequiredDataFields(definition).length).toBeGreaterThan(0);
    }
  });
});

describe("getMissingDataExplanation", () => {
  it("explains an empty group whose data is missing", () => {
    expect(
      getMissingDataExplanation({
        segmentName: "New Customers",
        memberCount: 0,
        availability: NONE,
      }),
    ).toBe(
      "Needs purchase dates from your point of sale. Your imported reports don't include them yet.",
    );
    expect(
      getMissingDataExplanation({
        segmentName: "  high-value   customers ",
        memberCount: 0,
        availability: NONE,
      }),
    ).toBe(MISSING_SEGMENT_DATA_MESSAGES.total_spent);
  });

  it("says nothing when the data exists (group is honestly empty)", () => {
    expect(
      getMissingDataExplanation({
        segmentName: "Perks Members",
        memberCount: 0,
        availability: { ...NONE, is_perks_member: true },
      }),
    ).toBeNull();
    expect(
      getMissingDataExplanation({
        segmentName: "Lapsed Customers",
        memberCount: 0,
        availability: ALL,
      }),
    ).toBeNull();
  });

  it("says nothing when the group has members", () => {
    expect(
      getMissingDataExplanation({
        segmentName: "New Customers",
        memberCount: 4,
        availability: NONE,
      }),
    ).toBeNull();
  });

  it("says nothing while availability is unknown (loading or error)", () => {
    for (const availability of [undefined, null]) {
      expect(
        getMissingDataExplanation({
          segmentName: "New Customers",
          memberCount: 0,
          availability,
        }),
      ).toBeNull();
    }
  });

  it("says nothing for groups that are not built-in", () => {
    expect(
      getMissingDataExplanation({
        segmentName: "Weekend regulars",
        memberCount: 0,
        availability: NONE,
      }),
    ).toBeNull();
  });
});
