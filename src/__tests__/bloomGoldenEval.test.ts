import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  gradeQuestion,
  looksLikePoem,
  numbersInJson,
  numbersInText,
  renderGoldenMarkdown,
  statesReachability,
  summarizeGolden,
} from "../../scripts/bloom-evals/golden-grader.mjs";
import {
  GOLDEN_QUESTIONS,
  NORTHFIELD_TENANT_ID,
  customerName,
  daysBefore,
  selectQuestions,
} from "../../scripts/bloom-evals/golden-questions.mjs";
import { gradeRecorded, readAppSupabaseConfig } from "../../scripts/bloom-evals/golden.mjs";
import { buildTranscript } from "../../scripts/bloom-evals/transcript.mjs";

// Northfield-shaped ground truth (fake data).
const TRUTH = {
  tenantId: NORTHFIELD_TENANT_ID,
  today: "2026-11-26",
  customerCount: { live: 9500, nonDeleted: 9500 },
  topSpenders: [
    { name: "Eleanor Whitfield", totalSpent: 12480.5 },
    { name: "Marcus Delacroix", totalSpent: 11902 },
    { name: "Priya Raman", totalSpent: 10875.25 },
    { name: "Owen Gallagher", totalSpent: 9640 },
    { name: "Sofia Lindqvist", totalSpent: 9310.75 },
    { name: "Hamish Corrigan", totalSpent: 8022 },
  ],
  lastSentCampaign: {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Spring Bulb Sale",
    sentAt: "2026-11-20T16:00:00Z",
    stats: { recipients: 1200, delivered: 1180, opens: 501, clicks: 59, openRate: 42.5, clickRate: 5, estimated: false },
  },
  lowStock: {
    names: ["Japanese Maple 5 gal", "Hydrangea Annabelle", "Organic Potting Mix 40L"],
    otherProductNames: ["Rose Fertilizer", "Garden Gloves", "Hydrangea"],
  },
  lapsed: { count: 950, cutoff: "2025-11-26" },
  vipSegment: { id: "62382792-0ff4-4338-bb03-05d14bb0075d", name: "VIP Buyers", memberCount: 412, storedCount: 412 },
  missingCampaign: { name: "Black Friday Blowout", matches: 0 },
  reachability: { total: 9500, reachable: 0, waiting: 0, stopped: 1900, unsendable: 7600 },
};

type Events = Array<{ event: string; data: unknown }>;

function turnOf(text: string, tools: Array<{ tool: string; result: Record<string, unknown> }> = [], extra: Events = []) {
  const events: Events = [];
  for (const { tool, result } of tools) {
    events.push({ event: "tool_start", data: { tool, params: {} } });
    events.push({ event: "tool_result", data: { tool, block_type: "table", result } });
  }
  events.push(...extra, { event: "token", data: { text } }, { event: "done", data: { conversation_id: "00000000-0000-4000-8000-000000000009" } });
  return { status: 200, json: null, transcript: buildTranscript(events), toolExecutions: [] };
}

const question = (id: string) => {
  const found = GOLDEN_QUESTIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
};

const grade = (id: string, turn: ReturnType<typeof turnOf>) => gradeQuestion(question(id), { turn }, TRUTH);

const failed = (result: ReturnType<typeof grade>) => result.checks.filter((check) => !check.pass).map((check) => check.check);

describe("golden question set", () => {
  it("has the nine questions and none asks Bloom to send, schedule or delete", () => {
    expect(GOLDEN_QUESTIONS.map((entry) => entry.id)).toEqual([
      "customer-count",
      "top-spenders",
      "last-campaign",
      "low-stock",
      "lapsed",
      "vip-segment",
      "missing-campaign",
      "email-readiness",
      "off-topic",
    ]);
    for (const entry of GOLDEN_QUESTIONS) {
      expect(entry.message).not.toMatch(/^(please\s+)?(send|schedule|delete|remove|launch)\b/i);
      expect(entry.message).not.toMatch(/\b(schedule|delete|remove)\b/i);
    }
  });

  it("selects questions by id and rejects unknown ids", () => {
    expect(selectQuestions(GOLDEN_QUESTIONS, "lapsed, off-topic").map((entry) => entry.id)).toEqual(["lapsed", "off-topic"]);
    expect(selectQuestions(GOLDEN_QUESTIONS, "")).toHaveLength(9);
    expect(() => selectQuestions(GOLDEN_QUESTIONS, "nope")).toThrow(/nope/);
  });

  it("computes the lapsed cutoff like current_date - 365 and names customers", () => {
    expect(daysBefore("2026-11-26", 365)).toBe("2025-11-26");
    expect(customerName({ first_name: " Eleanor ", last_name: "Whitfield" })).toBe("Eleanor Whitfield");
    expect(customerName({ first_name: null, last_name: null, email: "a@b.co" })).toBe("a@b.co");
  });

  it("reads the app's Supabase URL and publishable key from config.ts", () => {
    const source = readFileSync("src/integrations/supabase/config.ts", "utf8");
    const config = readAppSupabaseConfig(source, {});
    expect(config.url).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(config.anonKey.length).toBeGreaterThan(20);
    expect(readAppSupabaseConfig(source, { VITE_SUPABASE_PUBLISHABLE_KEY: "override" }).anonKey).toBe("override");
  });
});

describe("number helpers", () => {
  it("reads formatted numbers from text and JSON", () => {
    expect(numbersInText("You have 9,500 customers; $4,850.25 spent, 42.5% opened")).toEqual([9500, 4850.25, 42.5]);
    expect(numbersInJson({ a: 1, b: ["2,000", { c: "open 3.5%" }] })).toEqual([1, 2000, 3.5]);
  });

  it("recognises 0 of 9,500 reachable in different wordings", () => {
    expect(statesReachability("Right now 0 of your 9,500 customers can receive email.", 0, 9500)).toBe(true);
    expect(statesReachability("None of your 9,500 customers are reachable by email yet.", 0, 9500)).toBe(true);
    expect(statesReachability("You have 9,500 customers with email. Reachable: 0.", 0, 9500)).toBe(true);
    expect(statesReachability("Your sender domain is verified and ready.", 0, 9500)).toBe(false);
    expect(statesReachability("0 customers can receive email.", 0, 9500)).toBe(false);
  });

  it("spots verse", () => {
    expect(looksLikePoem("The waves roll in\nThe tide goes out\nThe gulls cry loud\nThe sea about")).toBe(true);
    expect(looksLikePoem("I'm here to help with your garden centre's customers and campaigns instead.")).toBe(false);
  });
});

describe("graders", () => {
  it("customer count: passes on the stated and grounded count, fails on a wrong one", () => {
    const good = grade("customer-count", turnOf("You have 9,500 customers.", [{ tool: "get_dashboard_summary", result: { success: true, total_customers: "9,500" } }]));
    expect(good.pass).toBe(true);
    expect(good.tools).toEqual(["get_dashboard_summary"]);

    const wrong = grade("customer-count", turnOf("You have about 9,000 customers.", [{ tool: "get_dashboard_summary", result: { total_customers: 9500 } }]));
    expect(wrong.pass).toBe(false);
    expect(failed(wrong)).toEqual(["answer states the customer count"]);

    const ungrounded = grade("customer-count", turnOf("You have 9,500 customers."));
    expect(failed(ungrounded)).toEqual(["a tool returned that count"]);
  });

  it("top spenders: needs all five names with amounts", () => {
    const rows = TRUTH.topSpenders.slice(0, 5).map((spender) => ({ name: spender.name, total_spent: spender.totalSpent.toFixed(2) }));
    const answer = [
      "1. Eleanor Whitfield — $12,480.50",
      "2. Marcus Delacroix — $11,902.00",
      "3. Priya Raman — $10,875.25",
      "4. Owen Gallagher — $9,640",
      "5. Sofia Lindqvist — $9,311",
    ].join("\n");
    expect(grade("top-spenders", turnOf(answer, [{ tool: "query_customers", result: { items: rows } }])).pass).toBe(true);

    const missing = grade("top-spenders", turnOf(answer.replace("Sofia Lindqvist — $9,311", "Hamish Corrigan — $8,022"), [{ tool: "query_customers", result: { items: rows } }]));
    expect(missing.pass).toBe(false);
    expect(failed(missing)).toContain("answer names the top 5 customers by spend");

    const noAmounts = grade("top-spenders", turnOf(TRUTH.topSpenders.slice(0, 5).map((spender) => spender.name).join(", "), [{ tool: "query_customers", result: { items: rows } }]));
    expect(failed(noAmounts)).toEqual(["answer gives each named customer's spend"]);
  });

  it("last campaign: name, open rate and click rate, grounded in the rollup", () => {
    const result = { success: true, campaign_name: "Spring Bulb Sale", key_metrics: { open_rate: 42.5, click_rate: 5 } };
    const good = grade("last-campaign", turnOf("Spring Bulb Sale had a 42.5% open rate and a 5% click rate.", [{ tool: "get_campaign_analytics", result }]));
    expect(good.pass).toBe(true);

    const rounded = grade("last-campaign", turnOf("Spring Bulb Sale: 43% opened, 5.0% clicked.", [{ tool: "get_campaign_analytics", result }]));
    expect(rounded.pass).toBe(true);

    const wrongRate = grade("last-campaign", turnOf("Spring Bulb Sale had a 38% open rate and a 5% click rate.", [{ tool: "get_campaign_analytics", result }]));
    expect(failed(wrongRate)).toEqual(["answer gives the open rate (42.5%)"]);
  });

  it("low stock: every item named, nothing extra", () => {
    const items = TRUTH.lowStock.names.map((name) => ({ name }));
    const answer = "Low on stock: Japanese Maple 5 gal, Hydrangea Annabelle and Organic Potting Mix 40L.";
    // "Hydrangea" is a non-low product whose name sits inside "Hydrangea Annabelle": not a false positive.
    expect(grade("low-stock", turnOf(answer, [{ tool: "query_products", result: { items } }])).pass).toBe(true);

    const extra = grade("low-stock", turnOf(`${answer} Garden Gloves are also running low.`, [{ tool: "query_products", result: { items } }]));
    expect(failed(extra)).toEqual(["answer names no product that is not low on stock"]);

    const short = grade("low-stock", turnOf("Japanese Maple 5 gal is low.", [{ tool: "query_products", result: { items } }]));
    expect(failed(short)).toEqual(["answer names every low-stock product"]);
  });

  it("lapsed: 950 by the segment rule, not the transaction-record 600", () => {
    const output = { success: true, recency: { by_customer_record: { count: 950 }, by_transaction_records: { count: 600 } } };
    expect(grade("lapsed", turnOf("950 customers haven't bought in over 12 months (600 by transaction records).", [{ tool: "explore_customer_purchases", result: output }])).pass).toBe(true);
    const wrong = grade("lapsed", turnOf("600 customers haven't bought in over 12 months.", [{ tool: "explore_customer_purchases", result: output }]));
    expect(failed(wrong)).toEqual(["answer states 950 lapsed customers"]);
  });

  it("VIP segment: the member count", () => {
    const output = { items: [{ name: "VIP Buyers", customer_count: 412 }] };
    expect(grade("vip-segment", turnOf("Your VIP Buyers segment has 412 customers.", [{ tool: "query_segments", result: output }])).pass).toBe(true);
    expect(grade("vip-segment", turnOf("Your VIP Buyers segment has 400 customers.", [{ tool: "query_segments", result: output }])).pass).toBe(false);
  });

  it("missing campaign: says not found, invents nothing, looked it up", () => {
    const lookup = [{ tool: "query_campaigns", result: { success: true, items: [], count: 0 } }];
    expect(grade("missing-campaign", turnOf("I couldn't find a campaign called Black Friday Blowout in your account.", lookup)).pass).toBe(true);

    const invented = grade("missing-campaign", turnOf("Your Black Friday Blowout campaign brought in $3,200 last year.", lookup));
    expect(failed(invented)).toEqual(["answer says the campaign was not found", "answer gives no revenue figure for it"]);

    const noLookup = grade("missing-campaign", turnOf("I couldn't find a campaign called Black Friday Blowout."));
    expect(failed(noLookup)).toEqual(["Bloom looked the campaign up"]);
  });

  it("email readiness: 0 of 9,500 reachable, never an unqualified yes", () => {
    const output = { success: true, total: 9500, reachable: 0, never_opted_in: 1900, unsendable: 7600 };
    const good = grade(
      "email-readiness",
      turnOf("Not yet: 0 of your 9,500 customers can receive email. 1,900 never opted in and 7,600 can't be sent to.", [{ tool: "get_email_health", result: output }]),
    );
    expect(good.pass).toBe(true);

    const yes = grade("email-readiness", turnOf("Yes, your sender is verified and you can send campaigns.", [{ tool: "get_email_health", result: output }]));
    expect(failed(yes)).toEqual([
      "answer says 0 of 9,500 customers can be emailed",
      "answer does not say the sender is ready",
    ]);
  });

  it("off-topic: declines or redirects, writes no poem", () => {
    expect(grade("off-topic", turnOf("I'm here to help with your garden centre's customers, products and campaigns. Want a campaign idea instead?")).pass).toBe(true);
    const poem = grade("off-topic", turnOf("The waves roll in\nThe tide goes out\nThe gulls cry loud\nThe sea about"));
    expect(poem.pass).toBe(false);
    expect(failed(poem)).toEqual(["answer declines or redirects", "answer does not write the poem"]);
  });

  it("baseline: an approval-required tool offered in a golden turn fails it", () => {
    const turn = turnOf("I couldn't find a campaign called Black Friday Blowout.", [
      { tool: "query_campaigns", result: { success: true, items: [] } },
      { tool: "create_campaign", result: { success: false, confirmation_required: true } },
    ]);
    const result = grade("missing-campaign", turn);
    expect(result.pass).toBe(false);
    const failures = failed(result);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^Bloom did not propose: /);
    expect(result.checks.find((check) => !check.pass)?.detail).toBe("proposed: create_campaign");
  });

  it("reads tool outputs from bloom_tool_executions rows too", () => {
    const turn = { ...turnOf("You have 9,500 customers."), toolExecutions: [{ tool_name: "get_dashboard_summary", status: "completed", tool_output: { total_customers: 9500 } }] };
    const result = grade("customer-count", turn);
    expect(result.pass).toBe(true);
    expect(result.tools).toEqual(["get_dashboard_summary"]);
  });
});

describe("report", () => {
  it("renders a pass/fail table and fails the run on any failure or harness error", () => {
    const results = gradeRecorded(
      [
        { id: "customer-count", turn: turnOf("You have 9,500 customers.", [{ tool: "get_dashboard_summary", result: { total_customers: 9500 } }]) },
        { id: "lapsed", error: "Bloom request timed out" },
      ],
      TRUTH,
    );
    expect(summarizeGolden(results)).toEqual({ passed: false, passCount: 1, total: 2 });
    const markdown = renderGoldenMarkdown(results, TRUTH);
    expect(markdown).toContain("## Bloom golden questions: FAILED (1/2)");
    expect(markdown).toContain("| 1 | How many customers do I have? | PASS | 9,500 customers | said 9,500 | get_dashboard_summary |");
    expect(markdown).toContain("| ERROR |");
    expect(markdown).toContain("Bloom request timed out");
    expect(summarizeGolden(results.slice(0, 1)).passed).toBe(true);
  });
});
