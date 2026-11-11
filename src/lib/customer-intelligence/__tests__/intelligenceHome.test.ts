import { describe, expect, it } from "vitest";
import { joinIntelligenceHome } from "../intelligenceHome";
describe("fast, truthful customer intelligence overview", () => {
  const customers = [
    { id: "c1", first_name: "Synthetic", last_name: "Buyer", email: null },
    { id: "c2", first_name: "Synthetic", last_name: "Unknown", email: null },
  ];
  const metrics = [
    {
      customer_id: "c1",
      lifetime_value: 149.5,
      purchase_velocity: -0.1,
      days_since_last_purchase: 55,
      customer_tier: "loyal",
      top_product_categories: ["Perennials"],
    },
  ];
  it("retains active customers without metrics, without inventing spending or visits", () => {
    const result = joinIntelligenceHome(customers, metrics);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      customer_id: "c1",
      lifetime_value: 149.5,
      first_name: "Synthetic",
    });
    expect(result[1]).toMatchObject({
      customer_id: "c2",
      lifetime_value: null,
      purchase_velocity: null,
      days_since_last_purchase: null,
    });
  });
  it("does not add metric-only identities to the displayed population", () => {
    const result = joinIntelligenceHome(customers, [
      ...metrics,
      { ...metrics[0], customer_id: "excluded-user" },
    ]);
    expect(result.map((row) => row.customer_id)).toEqual(["c1", "c2"]);
  });
  it("fails closed on repeated IDs rather than double-counting", () => {
    expect(() =>
      joinIntelligenceHome([customers[0], customers[0]], metrics),
    ).toThrow("Duplicate");
    expect(() =>
      joinIntelligenceHome(customers, [metrics[0], metrics[0]]),
    ).toThrow("Conflicting");
  });
});
