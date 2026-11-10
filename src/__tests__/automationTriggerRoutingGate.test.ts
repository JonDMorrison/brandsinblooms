import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("automation trigger routing gate", () => {
  it("routes Shopify and Clover through the durable trigger queue", () => {
    const shared = read(
      "supabase/functions/_shared/automation/fireAutomationTriggers.ts",
    );
    expect(shared).toContain('from("automation_trigger_events").upsert');
    expect(shared).toContain("source_event_key");
    expect(shared).not.toContain('from("crm_outbox").insert');
  });

  it("checks saved trigger conditions before queueing and before enrollment", () => {
    const shared = read(
      "supabase/functions/_shared/automation/fireAutomationTriggers.ts",
    );
    const square = read("supabase/functions/square-webhook-handler/index.ts");
    const executor = read("supabase/functions/automation-executor/index.ts");
    for (const source of [shared, square, executor]) {
      expect(source).toContain("matchesAutomationTriggerConditions");
    }
  });

  it("offers product and category filters for purchase triggers", () => {
    const editor = read(
      "src/components/automation/flow/editors/TriggerNodeEditor.tsx",
    );
    expect(editor).toContain("Product name contains (optional)");
    expect(editor).toContain("Product category contains (optional)");
    expect(editor).toContain("conditions.product_match");
    expect(editor).toContain("conditions.category_match");
  });
});
