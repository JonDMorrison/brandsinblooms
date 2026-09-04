import { describe, expect, it } from "vitest";
import { matchesAutomationTriggerConditions } from "../../supabase/functions/_shared/automation/triggerConditions";

describe("automation trigger conditions", () => {
  it("matches product terms across normalized provider payload shapes", () => {
    expect(
      matchesAutomationTriggerConditions(
        { product_match: "tomato, hydrangea" },
        { product_names: ["Organic Tomato Seedling", "Potting Soil"] },
      ),
    ).toBe(true);

    expect(
      matchesAutomationTriggerConditions(
        { product_match: "tomato" },
        { items: [{ name: "Houseplant Fertilizer" }] },
      ),
    ).toBe(false);
  });

  it("requires every configured dimension and fails closed on missing data", () => {
    expect(
      matchesAutomationTriggerConditions(
        { product_match: "tomato", category_match: "vegetable" },
        {
          items: [{ name: "Tomato Seedling", category_name: "Vegetables" }],
        },
      ),
    ).toBe(true);

    expect(
      matchesAutomationTriggerConditions(
        { product_match: "tomato", category_match: "vegetable" },
        { product_names: ["Tomato Seedling"] },
      ),
    ).toBe(false);
  });

  it("supports SKU, amount, and event identity constraints", () => {
    expect(
      matchesAutomationTriggerConditions(
        {
          sku: ["TOM-100"],
          min_order_amount: 50,
          max_order_amount: 100,
          segment_id: "segment-a",
        },
        {
          items: [{ sku: "tom-100" }],
          order_amount: 75,
          segment_id: "segment-a",
        },
      ),
    ).toBe(true);
  });

  it("ignores display metadata but rejects unsupported conditions", () => {
    expect(
      matchesAutomationTriggerConditions(
        { subtype: "payment.completed", product_match: "tomato" },
        { products: "Tomato Plant" },
      ),
    ).toBe(true);
    expect(
      matchesAutomationTriggerConditions(
        { future_unimplemented_filter: "yes" },
        { products: "Tomato Plant" },
      ),
    ).toBe(false);
  });
});
