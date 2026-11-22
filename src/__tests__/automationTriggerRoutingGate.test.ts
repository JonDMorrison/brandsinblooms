import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  isLoyaltyEnrollmentTrigger,
  writeAutomationOutbox,
} from "../../supabase/functions/_shared/automation/loyaltyEnrollment";

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

describe("loyalty enrollment event delivery", () => {
  it("routes both loyalty aliases as membership events, never new contacts", () => {
    expect(isLoyaltyEnrollmentTrigger("loyalty_join")).toBe(true);
    expect(isLoyaltyEnrollmentTrigger("loyalty.signup")).toBe(true);
    expect(isLoyaltyEnrollmentTrigger("contact.created")).toBe(false);
    const executor = read("supabase/functions/automation-executor/index.ts");
    const loyaltyCase = executor.slice(
      executor.indexOf('case "loyalty_join":'),
      executor.indexOf('case "first_purchase":'),
    );
    expect(loyaltyCase).toContain("return []");
    expect(loyaltyCase).not.toContain('query.gte("created_at"');
    expect(executor).toContain(
      "isLoyaltyEnrollmentTrigger(automation.trigger_type)",
    );
  });

  it("uses the claimed event/run step RPC and never a second direct insert for loyalty", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: { existing: true, outbox_id: "same-message" },
        error: null,
      });
    const db = { from: vi.fn(() => ({ insert })), rpc };
    await writeAutomationOutbox(
      db,
      {
        tenant_id: "untrusted-payload-scope",
        customer_id: "untrusted-customer",
        automation_run_id: "bound-run",
        step_index: 1,
        message_type: "email",
        content: "Welcome",
        recipient: "test@example.invalid",
        status: "queued",
        scheduled_at: "2026-11-22T00:00:00Z",
        template_data: {},
      },
      { eventId: "claimed-event", workerId: "current-worker" },
    );
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "enqueue_loyalty_automation_step",
      expect.objectContaining({
        p_event_id: "claimed-event",
        p_worker_id: "current-worker",
        p_run_id: "bound-run",
        p_step_index: 1,
      }),
    );
    expect(rpc.mock.calls[0][1].p_message).not.toHaveProperty("tenant_id");
    expect(rpc.mock.calls[0][1].p_message).not.toHaveProperty("customer_id");
  });

  it("fails on a lost event lease without falling back to an unguarded insert", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("Event claim lost") });
    await expect(
      writeAutomationOutbox(
        { from: () => ({ insert }), rpc },
        {
          automation_run_id: "run",
          step_index: 0,
        },
        { eventId: "event", workerId: "stale-worker" },
      ),
    ).rejects.toThrow("Event claim lost");
    expect(insert).not.toHaveBeenCalled();
  });

  it("preserves direct insertion for unrelated automation paths", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn();
    const payload = { content: "Unrelated reminder" };
    await writeAutomationOutbox({ from: () => ({ insert }), rpc }, payload);
    expect(insert).toHaveBeenCalledWith(payload);
    expect(rpc).not.toHaveBeenCalled();
  });
});
