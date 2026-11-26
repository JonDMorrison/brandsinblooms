// Bloom golden-question eval: asks the deployed bloom-assist a fixed set of
// read-only questions for the Northfield tenant (fake data), signed in as a
// test user, computes the correct answers from the database as that same user,
// and grades Bloom's tool outputs and final text. Exit code 1 on any failure.
//
// Unlike run.mjs (seeded synthetic companies on a NON-production eval project,
// service-role key), this suite runs against the live project and tenant with a
// normal user's session only. It refuses to run unless the user's effective
// Bloom tenant (the one bloom-assist resolves) is the expected tenant.
//
// Environment:
//   BLOOM_GOLDEN_EMAIL / BLOOM_GOLDEN_PASSWORD  test user credentials, or
//   BLOOM_GOLDEN_ACCESS_TOKEN                   a user access token instead
// Optional:
//   BLOOM_GOLDEN_QUESTIONS     comma-separated question ids (default: all)
//   BLOOM_GOLDEN_TENANT_ID     expected tenant (default: Northfield)
//   BLOOM_GOLDEN_SUPABASE_URL  override; default SUPABASE_URL in src/integrations/supabase/config.ts
//   VITE_SUPABASE_PUBLISHABLE_KEY  override; default the key in config.ts (same as the app)
//   BLOOM_GOLDEN_REPORT        JSON report path (default bloom-golden-report.json)
//   GITHUB_STEP_SUMMARY        markdown summary target, set by GitHub Actions
//
// Re-grade a saved report without calling Bloom:  node golden.mjs --replay report.json

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { resolveAdminWorkspaceTenant } from "../../supabase/functions/bloom-assist/admin-workspace.ts";
import { askBloom, signIn } from "./client.mjs";
import { gradeQuestion, renderGoldenMarkdown, summarizeGolden } from "./golden-grader.mjs";
import { GOLDEN_QUESTIONS, NORTHFIELD_TENANT_ID, computeGroundTruth, selectQuestions } from "./golden-questions.mjs";
import { systemPromptSentinels } from "./scorer.mjs";

const CONFIG_SOURCE = new URL("../../src/integrations/supabase/config.ts", import.meta.url);
const PROMPT_SOURCE = new URL("../../supabase/functions/bloom-assist/prompts/base-system-prompt.ts", import.meta.url);

/**
 * The Supabase URL and publishable key the app itself uses. config.ts reads
 * import.meta.env (Vite only), so it cannot be imported under Node; its two
 * values are read from the source instead, with the same env override.
 * @param {string} source contents of src/integrations/supabase/config.ts
 * @param {Record<string, string | undefined>} env
 */
export function readAppSupabaseConfig(source, env = process.env) {
  const url = source.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
  const key = source.match(/SUPABASE_PUBLISHABLE_KEY\s*=[\s\S]*?\|\|\s*"([^"]+)"/)?.[1];
  const resolvedUrl = env.BLOOM_GOLDEN_SUPABASE_URL?.trim() || url;
  const resolvedKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || key;
  if (!resolvedUrl || !resolvedKey) throw new Error("Could not read SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from src/integrations/supabase/config.ts");
  return { url: resolvedUrl, anonKey: resolvedKey };
}

/**
 * A supabase-js client that acts as the signed-in user.
 * @param {string} url @param {string} anonKey @param {string} accessToken
 */
function userClient(url, anonKey, accessToken) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * The tenant bloom-assist will answer in for this user (index.ts
 * resolveUserContext): the admin workspace for a master admin, else the user's
 * own tenant.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} userId
 */
export async function resolveBloomTenant(client, userId) {
  const workspace = await resolveAdminWorkspaceTenant(client, userId);
  if (workspace) return workspace;
  const { data, error } = await client.from("users").select("tenant_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Read the eval user's tenant: ${error.message}`);
  return typeof data?.tenant_id === "string" ? data.tenant_id : null;
}

/** @param {string} accessToken */
function userIdFromToken(accessToken) {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new Error("BLOOM_GOLDEN_ACCESS_TOKEN is not a JWT");
  const sub = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub;
  if (typeof sub !== "string") throw new Error("BLOOM_GOLDEN_ACCESS_TOKEN has no subject");
  return sub;
}

/**
 * @param {{
 *   url: string,
 *   anonKey: string,
 *   accessToken: string,
 *   userId: string,
 *   client: import("@supabase/supabase-js").SupabaseClient,
 *   questions: typeof GOLDEN_QUESTIONS,
 *   log?: (line: string) => void,
 *   ask?: typeof askBloom,
 * }} deps
 */
export async function runGoldenLive({ url, anonKey, accessToken, userId, client, questions, log = console.log, ask = askBloom }) {
  const recorded = [];
  for (const question of questions) {
    const startedAt = new Date().toISOString();
    try {
      // A new conversation per question, so answers never lean on each other.
      const turn = await ask({ url, anonKey, accessToken, message: question.message });
      const conversationId = typeof turn.transcript.done?.conversation_id === "string" ? turn.transcript.done.conversation_id : null;
      let executionsQuery = client
        .from("bloom_tool_executions")
        .select("tool_name, status, tool_output, created_at")
        .eq("user_id", userId)
        .gte("created_at", startedAt)
        .order("created_at", { ascending: true });
      if (conversationId) executionsQuery = executionsQuery.eq("conversation_id", conversationId);
      const executions = await executionsQuery;
      if (executions.error) throw new Error(`Read tool executions: ${executions.error.message}`);
      recorded.push({ id: question.id, turn: { ...turn, toolExecutions: executions.data ?? [] } });
      log(`  asked ${question.id} → HTTP ${turn.status}, tools: ${turn.transcript.toolCalls.map((call) => call.tool).join(", ") || "none"}`);
    } catch (error) {
      recorded.push({ id: question.id, error: error instanceof Error ? error.message : String(error) });
      log(`  ERROR ${question.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return recorded;
}

/**
 * @param {Array<{ id: string, turn?: import("./scorer.mjs").TurnObservation, error?: string }>} recorded
 * @param {import("./golden-grader.mjs").GroundTruth} truth
 * @param {{ secretSentinels?: string[], questions?: typeof GOLDEN_QUESTIONS }} [options]
 */
export function gradeRecorded(recorded, truth, { secretSentinels = [], questions = GOLDEN_QUESTIONS } = {}) {
  return recorded.map((entry) => {
    const question = questions.find((candidate) => candidate.id === entry.id) ?? { id: entry.id, message: entry.id, why: "" };
    return gradeQuestion(question, entry, truth, { secretSentinels });
  });
}

/** @param {string | undefined} value @param {string} name */
function required(value, name) {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

async function main(argv) {
  const secretSentinels = systemPromptSentinels(readFileSync(PROMPT_SOURCE, "utf8"));
  const reportPath = process.env.BLOOM_GOLDEN_REPORT || "bloom-golden-report.json";

  let recorded;
  let truth;
  const replayIndex = argv.indexOf("--replay");
  if (replayIndex !== -1) {
    const saved = JSON.parse(readFileSync(required(argv[replayIndex + 1], "--replay <report.json>"), "utf8"));
    recorded = saved.recorded;
    truth = saved.truth;
  } else {
    const { url, anonKey } = readAppSupabaseConfig(readFileSync(CONFIG_SOURCE, "utf8"));
    const expectedTenant = process.env.BLOOM_GOLDEN_TENANT_ID?.trim() || NORTHFIELD_TENANT_ID;
    const questions = selectQuestions(GOLDEN_QUESTIONS, process.env.BLOOM_GOLDEN_QUESTIONS);

    let accessToken;
    let userId;
    if (process.env.BLOOM_GOLDEN_ACCESS_TOKEN?.trim()) {
      accessToken = process.env.BLOOM_GOLDEN_ACCESS_TOKEN.trim();
      userId = userIdFromToken(accessToken);
    } else {
      ({ accessToken, userId } = await signIn({
        url,
        anonKey,
        email: required(process.env.BLOOM_GOLDEN_EMAIL, "BLOOM_GOLDEN_EMAIL (or BLOOM_GOLDEN_ACCESS_TOKEN)"),
        password: required(process.env.BLOOM_GOLDEN_PASSWORD, "BLOOM_GOLDEN_PASSWORD"),
      }));
    }
    const client = userClient(url, anonKey, accessToken);

    const bloomTenant = await resolveBloomTenant(client, userId);
    if (bloomTenant !== expectedTenant) {
      throw new Error(
        `The eval user answers in tenant ${bloomTenant ?? "(none)"}, not ${expectedTenant}. ` +
          "Refusing to run: the golden answers are computed for the expected tenant only.",
      );
    }

    console.log(`Computing ground truth for tenant ${expectedTenant}…`);
    truth = await computeGroundTruth(client, expectedTenant);
    console.log(`Asking Bloom ${questions.length} question(s)…`);
    recorded = await runGoldenLive({ url, anonKey, accessToken, userId, client, questions });
  }

  const results = gradeRecorded(recorded, truth, { secretSentinels });
  writeFileSync(reportPath, JSON.stringify({ summary: summarizeGolden(results), results, truth, recorded }, null, 2));
  const markdown = renderGoldenMarkdown(results, truth);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  return summarizeGolden(results).passed;
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
