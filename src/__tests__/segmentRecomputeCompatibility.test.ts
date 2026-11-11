import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateSegmentRule,
  normalizeSegmentRuleGroup,
} from "../../supabase/functions/_shared/segmentEvaluator";

describe("segment recompute compatibility", () => {
  it("targets active dynamic segments and the shared current evaluator", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "supabase/functions/recompute-segment-memberships/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain('from "../_shared/segmentEvaluator.ts"');
    expect(source).toContain('.eq("auto_update", true)');
    expect(source).toContain('.eq("status", "active")');
    expect(source).not.toContain("evaluateConditions(");
  });

  it("evaluates current nested rules against imported custom fields", () => {
    const rules = normalizeSegmentRuleGroup({
      kind: "group",
      operator: "AND",
      children: [
        {
          kind: "rule",
          fieldId: "custom:annual_spend",
          operatorId: "greater_than",
          value: 1000,
        },
        {
          kind: "group",
          operator: "OR",
          children: [
            {
              kind: "rule",
              fieldId: "custom:business_type",
              operatorId: "equals",
              value: "IGC",
            },
            {
              kind: "rule",
              fieldId: "custom:business_type",
              operatorId: "equals",
              value: "Nursery",
            },
          ],
        },
      ],
    });

    expect(
      evaluateSegmentRule(rules, {
        custom_fields: { annual_spend: 1250, business_type: "IGC" },
      }),
    ).toBe(true);
    expect(
      evaluateSegmentRule(rules, {
        custom_fields: { annual_spend: 900, business_type: "IGC" },
      }),
    ).toBe(false);
  });

  it("keeps legacy dotted custom fields and comparison operators working", () => {
    const legacy = normalizeSegmentRuleGroup({
      logic: "AND",
      conditions: [
        {
          field: "custom_fields.loyalty_points",
          operator: ">=",
          value: 500,
        },
      ],
    });

    expect(
      evaluateSegmentRule(legacy, {
        custom_fields: { loyalty_points: 500 },
      }),
    ).toBe(true);
  });

  it("normalizes the legacy rules shape used by existing system segments", () => {
    const legacy = normalizeSegmentRuleGroup({
      logic: "OR",
      rules: [
        { field: "lifetime_value", operator: "gt", value: 1000 },
        { field: "pos_order_count", operator: "gte", value: 10 },
      ],
    });

    expect(
      evaluateSegmentRule(legacy, {
        lifetime_value: 250,
        pos_order_count: 12,
      }),
    ).toBe(true);
  });

  it("never treats an empty static-style condition set as a match", () => {
    expect(evaluateSegmentRule(normalizeSegmentRuleGroup({}), {})).toBe(false);
  });

  it("evaluates the legacy relative-day operators", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));

    const recent = normalizeSegmentRuleGroup({
      conditions: [
        {
          field: "last_purchase_date",
          operator: "within_days",
          value: 30,
        },
      ],
    });

    expect(
      evaluateSegmentRule(recent, { last_purchase_date: "2026-08-20" }),
    ).toBe(true);
    expect(
      evaluateSegmentRule(recent, { last_purchase_date: "2026-07-01" }),
    ).toBe(false);

    vi.useRealTimers();
  });

  it("the editor loads the built-in Lapsed rule and matches the same customers as the server", async () => {
    const { normalizeSegmentRuleGroup: editorNormalize } = await import("@/lib/segmentFields");
    const lapsed = { logic: "AND", rules: [{ field: "last_purchase_date", operator: "older_than_days", value: 90 }] };
    const editorGroup = editorNormalize(lapsed);
    expect(editorGroup.children).toHaveLength(1);
    expect(editorGroup.children[0]).toMatchObject({
      kind: "rule",
      fieldId: "last_purchase_date",
      operatorId: "not_within_last",
      value: { amount: 90, unit: "days" },
    });

    const day = 86400000;
    const customers = [
      { id: "old", last_purchase_date: new Date(Date.now() - 200 * day).toISOString() },
      { id: "recent", last_purchase_date: new Date(Date.now() - 10 * day).toISOString() },
      { id: "none", last_purchase_date: null },
    ];
    const serverGroup = normalizeSegmentRuleGroup(lapsed);
    const reloadedGroup = normalizeSegmentRuleGroup(editorGroup);
    for (const customer of customers) {
      expect(evaluateSegmentRule(reloadedGroup, customer)).toBe(evaluateSegmentRule(serverGroup, customer));
    }
    expect(customers.filter((customer) => evaluateSegmentRule(reloadedGroup, customer)).map((c) => c.id)).toEqual(["old"]);
  });
});
