import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CustomerData } from "@/hooks/useCustomerDashboard";
import { getCustomerProfileAttributes } from "@/lib/crm/customerProfileAttributes";

const customer = {
  id: "customer-1",
  tenant_id: "tenant-1",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Smith",
  phone: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-09-03T00:00:00Z",
  tags: ["VIP", "workshop attendee", "VIP"],
  product_tags: ["Tomatoes", "Houseplants"],
  custom_fields: {
    interests: ["vegetable gardening", "native plants"],
    gardening_experience: "intermediate",
    organization_type: "IGC",
    annual_spend_band: "1000-2500",
    preference_center_source: "customer",
    nested_internal_data: { ignore: true },
  },
} satisfies CustomerData;

describe("unified customer profile release gate", () => {
  it("normalizes customer-selected, inferred, tagged, and imported attributes", () => {
    expect(getCustomerProfileAttributes(customer)).toEqual({
      interests: ["Vegetable Gardening", "Native Plants"],
      experience: "Intermediate",
      tags: ["VIP", "workshop attendee"],
      purchaseTags: ["Tomatoes", "Houseplants"],
      customFields: [
        {
          key: "annual_spend_band",
          label: "Annual Spend Band",
          value: "1000-2500",
        },
        {
          key: "organization_type",
          label: "Organization Type",
          value: "IGC",
        },
      ],
    });
  });

  it("loads profile attributes even when the enriched view succeeds", () => {
    const dashboardHook = readFileSync("src/hooks/useCustomerDashboard.ts", "utf8");

    expect(dashboardHook).toContain(
      "tags, product_tags, custom_fields, persona, is_vip",
    );
    expect(dashboardHook).toContain("...(baseCustomer ?? {})");
  });

  it("loads recent automation state by customer without exposing mutation actions", () => {
    const automationHook = readFileSync(
      "src/hooks/useCustomerAutomationRuns.ts",
      "utf8",
    );
    const automationCard = readFileSync(
      "src/components/crm/customer-dashboard/CustomerAutomationsCard.tsx",
      "utf8",
    );

    expect(automationHook).toContain('.from("automation_runs")');
    expect(automationHook).toContain('.eq("customer_id", customerId)');
    expect(automationHook).toContain("automation:crm_automations(name, trigger_type)");
    expect(automationHook).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(automationCard).toContain("Current and recent customer journeys");
    expect(automationCard).toContain("next_step_scheduled_at");
    expect(automationCard).toContain("error_message");
  });
});
