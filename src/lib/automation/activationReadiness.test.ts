import { describe, expect, it } from "vitest";
import {
  AUTOMATION_NEEDS_TRIGGER_MESSAGE,
  checkAutomationActivation,
  flowHasTrigger,
} from "./activationReadiness";

// Northfield "Bring lapsed customers back" before (empty flow) and after the
// legacy-to-flow migration, as stored in production on 2026-11-24.
const emptyFlow = { nodes: [], edges: [] };
const migratedFlow = {
  nodes: [
    {
      id: "trigger-legacy",
      type: "trigger",
      data: { label: "Bring lapsed customers back", triggerType: "repeat_purchase_90d", conditions: { days: 90 } },
    },
    { id: "email-legacy-1", type: "email", data: { subject: "We Miss You", template: "we_miss_you" } },
  ],
  edges: [{ id: "e1", source: "trigger-legacy", target: "email-legacy-1" }],
};

describe("automation activation guard", () => {
  it("blocks activation when the flow has no trigger node", () => {
    expect(flowHasTrigger(emptyFlow)).toBe(false);
    expect(checkAutomationActivation(emptyFlow)).toEqual({
      canActivate: false,
      reason: AUTOMATION_NEEDS_TRIGGER_MESSAGE,
    });
    expect(
      checkAutomationActivation({ nodes: [{ id: "e", type: "email" }] }).canActivate,
    ).toBe(false);
  });

  it("allows activation once a trigger node exists", () => {
    expect(flowHasTrigger(migratedFlow)).toBe(true);
    expect(checkAutomationActivation(migratedFlow)).toEqual({ canActivate: true });
  });

  it("treats malformed flow state as needing setup", () => {
    for (const value of [null, undefined, "x", [], { nodes: "trigger" }, { nodes: [null] }]) {
      expect(flowHasTrigger(value)).toBe(false);
    }
  });
});
