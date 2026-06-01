import { describe, expect, it } from "vitest";
import {
  evaluateSegmentRule,
  type SegmentRuleGroup,
} from "@/lib/segmentFields";

const baseCustomer = {
  id: "c1",
  tenant_id: "t1",
  email: "owner@example.com",
  email_opt_in: true,
  suppressed: false,
  opt_out: false,
  custom_fields: {},
} as any;

const groupWithBlankRule: SegmentRuleGroup = {
  id: "group-0",
  kind: "group",
  operator: "AND",
  children: [
    {
      id: "rule-blank",
      kind: "rule",
      fieldId: null,
      operatorId: null,
      value: null,
    },
  ],
};

const emptyGroup: SegmentRuleGroup = {
  id: "group-empty",
  kind: "group",
  operator: "AND",
  children: [],
};

describe("evaluateSegmentRule — include-all/empty group handling", () => {
  it("matches every customer when the group has no children (vacuous truth)", () => {
    expect(evaluateSegmentRule(emptyGroup, baseCustomer)).toBe(true);
  });

  it("matches every customer when the group has only blank placeholder rules", () => {
    expect(evaluateSegmentRule(groupWithBlankRule, baseCustomer)).toBe(true);
  });

  it("does not match when a real rule is present and fails", () => {
    const realRule: SegmentRuleGroup = {
      id: "group-real",
      kind: "group",
      operator: "AND",
      children: [
        {
          id: "rule-real",
          kind: "rule",
          fieldId: "is_vip",
          operatorId: "is",
          value: true,
        },
      ],
    };
    expect(evaluateSegmentRule(realRule, { ...baseCustomer, is_vip: false })).toBe(
      false,
    );
  });

  it("ignores blank rules sitting alongside a real rule", () => {
    const mixed: SegmentRuleGroup = {
      id: "group-mixed",
      kind: "group",
      operator: "AND",
      children: [
        {
          id: "rule-blank",
          kind: "rule",
          fieldId: null,
          operatorId: null,
          value: null,
        },
        {
          id: "rule-real",
          kind: "rule",
          fieldId: "is_vip",
          operatorId: "is",
          value: true,
        },
      ],
    };
    expect(evaluateSegmentRule(mixed, { ...baseCustomer, is_vip: true })).toBe(
      true,
    );
    expect(evaluateSegmentRule(mixed, { ...baseCustomer, is_vip: false })).toBe(
      false,
    );
  });
});
