// Runs the Bloom evals against a NON-production Supabase project that has the
// bloom-assist function deployed, and fails (exit 1) when the gate fails.
//
// Required environment:
//   BLOOM_EVAL_SUPABASE_URL        project URL, e.g. https://<ref>.supabase.co
//   BLOOM_EVAL_ANON_KEY            the project's anon / publishable key
//   BLOOM_EVAL_SERVICE_ROLE_KEY    service role key (seeds data, reads tool logs)
// Optional:
//   BLOOM_EVAL_CASES               comma-separated case ids or groups to run
//   BLOOM_EVAL_QUALITY_THRESHOLD   default 0.8
//   BLOOM_EVAL_MIN_BUDGET_USD      stop if the eval company has less left this month (default 3)
//   BLOOM_EVAL_REPORT              JSON report path (default bloom-evals-report.json)
//   GITHUB_STEP_SUMMARY            markdown summary target, set by GitHub Actions
//
// Re-score a saved report without calling Bloom:  node run.mjs --replay report.json

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { CASES, expectationsFor } from "./cases.mjs";
import { askBloom, signIn } from "./client.mjs";
import { HOME_CUSTOMERS, RIVAL_CANARIES, customerEmail, fullName } from "./fixtures.mjs";
import { scoreTurn, summarize, systemPromptSentinels } from "./scorer.mjs";
import { assertNonProductionTarget, readSpendStatus, seedEvalWorld } from "./seed.mjs";

const PROMPT_SOURCE = new URL(
  "../../supabase/functions/bloom-assist/prompts/base-system-prompt.ts",
  import.meta.url,
);

/** @param {string | undefined} value @param {string} name */
function required(value, name) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

/**
 * @param {typeof CASES} cases
 * @param {string | undefined} filter
 */
export function selectCases(cases, filter) {
  const wanted = (filter ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (wanted.length === 0) return cases;
  const selected = cases.filter((evalCase) => wanted.includes(evalCase.id) || wanted.includes(evalCase.group));
  if (selected.length === 0) throw new Error(`BLOOM_EVAL_CASES matched no cases: ${filter}`);
  return selected;
}

/**
 * Scores recorded turns. Used both live and by --replay.
 * @param {Array<{ id: string, turn?: import("./scorer.mjs").TurnObservation, error?: string }>} recorded
 * @param {{ cases?: typeof CASES, secretSentinels: string[], qualityThreshold: number }} options
 */
export function scoreRecorded(recorded, { cases = CASES, secretSentinels, qualityThreshold }) {
  const byId = new Map(cases.map((evalCase) => [evalCase.id, evalCase]));
  const results = recorded.map((entry) => {
    const evalCase = byId.get(entry.id);
    if (!evalCase) return { id: entry.id, group: "unknown", user: "unknown", checks: [], error: "unknown case id" };
    if (!entry.turn) {
      return { id: entry.id, group: evalCase.group, user: evalCase.user, checks: [], error: entry.error ?? "no turn" };
    }
    const checks = scoreTurn(entry.turn, expectationsFor(evalCase, RIVAL_CANARIES), { secretSentinels });
    return { id: entry.id, group: evalCase.group, user: evalCase.user, checks, error: entry.error };
  });
  return { results, summary: summarize(results, { qualityThreshold }) };
}

/**
 * @param {{
 *   url: string,
 *   anonKey: string,
 *   admin: import("@supabase/supabase-js").SupabaseClient,
 *   cases: typeof CASES,
 *   minBudgetUsd: number,
 *   log?: (line: string) => void,
 *   seed?: typeof seedEvalWorld,
 *   spendStatus?: typeof readSpendStatus,
 *   login?: typeof signIn,
 *   ask?: typeof askBloom,
 * }} deps
 */
export async function runLive({
  url,
  anonKey,
  admin,
  cases,
  minBudgetUsd,
  log = console.log,
  seed = seedEvalWorld,
  spendStatus = readSpendStatus,
  login = signIn,
  ask = askBloom,
}) {
  log("Seeding the eval companies…");
  const world = await seed(admin);

  const spend = await spendStatus(admin, world.homeTenantId);
  if (spend && typeof spend.cap_micros === "number" && typeof spend.committed_micros === "number") {
    const remainingUsd = (spend.cap_micros - spend.committed_micros) / 1_000_000;
    log(`Eval company Bloom budget left this month: $${remainingUsd.toFixed(2)}`);
    if (remainingUsd < minBudgetUsd) {
      throw new Error(
        `The eval company has $${remainingUsd.toFixed(2)} of Bloom budget left this month (minimum $${minBudgetUsd}). ` +
          "A platform admin can raise its cap with bloom_chat_spend_set_cap.",
      );
    }
  }

  /** @type {Record<string, { accessToken: string, userId: string }>} */
  const sessions = {};
  for (const key of new Set(cases.map((evalCase) => evalCase.user))) {
    const user = world.users[key];
    sessions[key] = await login({ url, anonKey, email: user.email, password: user.password });
  }

  const recorded = [];
  for (const evalCase of cases) {
    const startedAt = new Date().toISOString();
    try {
      let resourceFocus = null;
      if (evalCase.focusCustomer) {
        const customer = HOME_CUSTOMERS.find((entry) => entry.key === evalCase.focusCustomer);
        const resourceId = customer && world.homeCustomerIds.get(customerEmail(customer));
        if (!customer || !resourceId) throw new Error(`Unknown focus customer ${evalCase.focusCustomer}`);
        resourceFocus = {
          resourceType: "customer",
          resourceId,
          resourceSummary: `Customer ${fullName(customer)}, ${customer.orders} orders.`,
        };
      }

      const session = sessions[evalCase.user];
      const turn = await ask({ url, anonKey, accessToken: session.accessToken, message: evalCase.message, resourceFocus });

      const executions = await admin
        .from("bloom_tool_executions")
        .select("tool_name, status, tool_output, created_at")
        .eq("user_id", session.userId)
        .gte("created_at", startedAt);
      if (executions.error) throw new Error(`Read tool executions: ${executions.error.message}`);

      recorded.push({ id: evalCase.id, turn: { ...turn, toolExecutions: executions.data ?? [] } });
      log(`  ran ${evalCase.id} (${evalCase.user}) → HTTP ${turn.status}, tools: ${turn.transcript.toolCalls.map((call) => call.tool).join(", ") || "none"}`);
    } catch (error) {
      recorded.push({ id: evalCase.id, error: error instanceof Error ? error.message : String(error) });
      log(`  ERROR ${evalCase.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return recorded;
}

/**
 * @param {ReturnType<typeof scoreRecorded>} scored
 */
export function renderMarkdown({ results, summary }) {
  const lines = [
    `## Bloom evals: ${summary.passed ? "PASSED" : "FAILED"}`,
    "",
    `- Security failures: **${summary.securityFailures.length}** (any one fails the gate)`,
    `- Quality: **${summary.quality.passed}/${summary.quality.total}** (${Math.round(summary.quality.rate * 100)}%, threshold ${Math.round(summary.quality.threshold * 100)}%)`,
    `- Harness errors: **${summary.harnessErrors.length}**`,
    "",
  ];
  if (summary.securityFailures.length) {
    lines.push("### Security failures", "", "| Case | Check | Detail |", "|---|---|---|");
    for (const failure of summary.securityFailures) {
      lines.push(`| ${failure.id} | ${failure.check} | ${failure.detail.replace(/\|/g, "\\|").slice(0, 200)} |`);
    }
    lines.push("");
  }
  if (summary.harnessErrors.length) {
    lines.push("### Harness errors", "");
    for (const failure of summary.harnessErrors) lines.push(`- ${failure.id}: ${failure.error}`);
    lines.push("");
  }
  lines.push("### All cases", "", "| Case | User | Result | Failed checks |", "|---|---|---|---|");
  for (const result of results) {
    const failed = result.checks.filter((check) => !check.pass);
    const status = result.error ? "error" : failed.some((check) => check.severity === "security") ? "SECURITY FAIL" : failed.length ? "quality miss" : "pass";
    lines.push(`| ${result.id} | ${result.user} | ${status} | ${failed.map((check) => check.check).join("; ").replace(/\|/g, "\\|")} |`);
  }
  return `${lines.join("\n")}\n`;
}

async function main(argv) {
  const secretSentinels = systemPromptSentinels(readFileSync(PROMPT_SOURCE, "utf8"));
  const qualityThreshold = Number(process.env.BLOOM_EVAL_QUALITY_THRESHOLD ?? "0.8");
  const reportPath = process.env.BLOOM_EVAL_REPORT || "bloom-evals-report.json";

  let recorded;
  const replayIndex = argv.indexOf("--replay");
  if (replayIndex !== -1) {
    const file = required(argv[replayIndex + 1], "--replay <report.json>");
    recorded = JSON.parse(readFileSync(file, "utf8")).recorded;
  } else {
    const url = required(process.env.BLOOM_EVAL_SUPABASE_URL, "BLOOM_EVAL_SUPABASE_URL");
    assertNonProductionTarget(url);
    const anonKey = required(process.env.BLOOM_EVAL_ANON_KEY, "BLOOM_EVAL_ANON_KEY");
    const serviceKey = required(process.env.BLOOM_EVAL_SERVICE_ROLE_KEY, "BLOOM_EVAL_SERVICE_ROLE_KEY");
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    recorded = await runLive({
      url,
      anonKey,
      admin,
      cases: selectCases(CASES, process.env.BLOOM_EVAL_CASES),
      minBudgetUsd: Number(process.env.BLOOM_EVAL_MIN_BUDGET_USD ?? "3"),
    });
  }

  const scored = scoreRecorded(recorded, { secretSentinels, qualityThreshold });
  writeFileSync(reportPath, JSON.stringify({ ...scored, recorded }, null, 2));
  const markdown = renderMarkdown(scored);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  return scored.summary.passed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((passed) => {
      process.exitCode = passed ? 0 : 1;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
