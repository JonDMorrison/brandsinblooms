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
});
