import { describe, expect, it } from "vitest";
import { toJsonResult } from "../../supabase/functions/bloom-assist/stream-handler";
import {
  correctFalseFailureReply,
  toolOutcomeFrom,
} from "../../supabase/functions/bloom-assist/reply-guard";

// The shape explore_customer_purchases returned for "Top 50 Tropical shoppers":
// one optional field was undefined.
const tropicalsResult = {
  success: true,
  count: 6648,
  message: "Search succeeded: 6,648 customers bought it. 14,971 have purchase records without it. 26,315 have no purchase records on file, so they are counted separately. This is a complete answer, not an error.",
  error: null,
  block_type: "data_table",
  data: {
    kind: "customer_exploration",
    included_count: 6648,
    evidence_note: undefined,
    rows: [{ customer_id: "a", name: "Jayne Ercog", matched_reported_spend: 1442.13 }],
    trail: [{ label: "Top 50 Tropical Shoppers" }],
  },
};

describe("tool results reach Bloom's model intact", () => {
  it("keeps a successful result when one field is undefined", () => {
    const json = toJsonResult(tropicalsResult) as Record<string, unknown>;
    expect(json).not.toBeNull();
    expect(json.success).toBe(true);
    expect(json.message).toContain("6,648 customers bought it");
    expect((json.data as Record<string, unknown>).rows).toHaveLength(1);
    expect(json.data).not.toHaveProperty("evidence_note");
  });

  it("lets the reply guard see the success it needs", () => {
    const outcome = toolOutcomeFrom("completed", toJsonResult(tropicalsResult));
    expect(correctFalseFailureReply("It seems there was an issue accessing the data.", [outcome])).toContain("6,648 customers bought it");
  });

  it("still returns null for values that cannot be JSON", () => {
    expect(toJsonResult(undefined)).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(toJsonResult(circular)).toBeNull();
  });

  it("leaves plain JSON untouched", () => {
    const plain = { success: true, count: 1, data: [1, "a", null] };
    expect(toJsonResult(plain)).toBe(plain);
  });
});
