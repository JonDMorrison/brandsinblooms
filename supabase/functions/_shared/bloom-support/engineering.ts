// Bloom Support — automatic engineering pipeline.
//
//   investigate (repair identity)  → GitHub issue with sanitized evidence
//                                  → dispatch the repo's bloom-repair workflow
//   poll        (repair identity)  → find the fix PR on bloom/fix-<id>
//   evaluate    (release identity) → deterministic policy on PR facts
//   release     (release identity) → merge pinned to the evaluated SHA
//   deploy      (release identity) → production deployment for the merge SHA
//   verify      (release identity) → production checks from the reproduction
//
// The repair side never holds merge credentials and cannot write eligibility.
// Every step is an idempotent job; state lives in bloom_support.engineering_issues.
import { BloomError, type Caller, env, rpc } from "./runtime.ts";
import { evaluateRelease, PRODUCT_REPOSITORIES, redactText, resolvePolicy, type Product } from "./policy.ts";
import { findPullRequestForBranch, gh, mergePullRequest, productionDeployment, pullRequestFacts } from "./github.ts";

export interface EngineeringIssue {
  id: string; title: string; product: Product; repository: string | null; status: string; version: number;
  evidence: Record<string, unknown>; reproduction: Record<string, unknown> | null; branch: string | null;
  pr_number: number | null; pr_url: string | null; head_sha: string | null; merge_sha: string | null;
  deployment: Record<string, unknown> | null; verification: Record<string, unknown> | null; eligibility: Record<string, unknown> | null;
  attempts: number;
  tickets: Array<{ id: string; number: number; subject: string; account_id: string | null; status: string }>;
}

export type StepResult = { next?: { step: string; delaySeconds: number }; note: string };

async function loadIssue(actor: Caller, id: string): Promise<EngineeringIssue> {
  const all = await rpc<EngineeringIssue[]>("list_engineering", { actor: actor.principalId });
  const issue = all.find((e) => e.id === id);
  if (!issue) throw new BloomError(404, "not_found", "engineering issue");
  return issue;
}

async function update(actor: Caller, issue: EngineeringIssue, status: string | null, patch: Record<string, unknown>, note?: string) {
  return await rpc("update_engineering_issue", { actor: actor.principalId, issue_id: issue.id, update: { ...(status ? { status } : {}), patch, note } });
}

export function branchFor(issueId: string): string {
  return `bloom/fix-${issueId.slice(0, 8)}`;
}

function repoFor(issue: EngineeringIssue): { repository: string; base: string } | null {
  if (issue.repository) {
    const known = Object.values(PRODUCT_REPOSITORIES).find((r) => r.repository.toLowerCase() === issue.repository!.toLowerCase());
    return { repository: issue.repository, base: known?.base ?? "main" };
  }
  const m = PRODUCT_REPOSITORIES[issue.product as keyof typeof PRODUCT_REPOSITORIES];
  return m ? { repository: m.repository, base: m.base } : null;
}

/** Evidence for the coding agent: sanitized summaries only, no client contact data. */
async function evidenceFor(automation: Caller, issue: EngineeringIssue): Promise<string> {
  const parts: string[] = [];
  for (const t of issue.tickets.slice(0, 5)) {
    const full = await rpc<Record<string, unknown>>("get_ticket", { actor: automation.principalId, ticket_id: t.id });
    const ctx = (full.context ?? {}) as Record<string, unknown>;
    parts.push([
      `### Report #${t.number}: ${redactText(String(full.subject ?? ""))}`,
      redactText(String(full.summary ?? "")).slice(0, 3000),
      `Context: ${JSON.stringify({ page_url: ctx.page_url, app_version: ctx.app_version ?? ctx.release, browser: ctx.browser ?? ctx.user_agent, error_ids: ctx.error_ids, trace_ids: ctx.trace_ids, record_refs: ctx.record_refs }).slice(0, 1500)}`,
    ].join("\n"));
  }
  return parts.join("\n\n");
}

export async function investigate(repair: Caller, automation: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(repair, issueId);
  if (!["open", "investigating", "not_reproduced", "failed"].includes(issue.status)) return { note: `already ${issue.status}` };
  const target = repoFor(issue);
  if (!target) {
    await update(repair, issue, "escalated", {}, "Product unknown: Bloom cannot map this report to a repository");
    return { note: "escalated: unknown product" };
  }
  const branch = branchFor(issue.id);
  const evidence = await evidenceFor(automation, issue);
  let ghIssue = (issue.evidence?.github_issue as { number: number; url: string } | undefined) ?? null;
  if (!ghIssue) {
    const created = await gh<{ number: number; html_url: string }>("repair", "POST", `/repos/${target.repository}/issues`, {
      title: `[Bloom] ${issue.title}`.slice(0, 250),
      body: [
        `Bloom engineering issue \`${issue.id}\`. Fix branch: \`${branch}\` → \`${target.base}\`.`,
        "",
        "Reports (sanitized; client contact details removed):",
        "",
        evidence,
        "",
        "Repair rules: reproduce first with a focused failing test, fix the root cause, never weaken or delete existing tests,",
        "never edit workflows, release policy, migrations, auth, payments or secrets. If the fix needs any of those, stop and say so.",
      ].join("\n"),
      labels: ["bloom-repair"],
    });
    ghIssue = { number: created.number, url: created.html_url };
  }
  await update(repair, issue, "investigating", { repository: target.repository, branch, evidence: { github_issue: ghIssue } }, `GitHub issue #${ghIssue.number}`);
  const workflow = env("BLOOM_REPAIR_WORKFLOW") ?? "bloom-repair.yml";
  try {
    await gh("repair", "POST", `/repos/${target.repository}/actions/workflows/${workflow}/dispatches`, {
      ref: target.base,
      inputs: { github_issue: String(ghIssue.number), engineering_issue_id: issue.id, branch, base: target.base },
    });
  } catch (e) {
    await update(repair, issue, "escalated", {}, `Repair workflow could not start in ${target.repository}: ${e instanceof Error ? e.message : e}`);
    return { note: "escalated: workflow dispatch failed" };
  }
  return { next: { step: "poll", delaySeconds: 300 }, note: `dispatched ${workflow} on ${target.repository}` };
}

export async function poll(repair: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(repair, issueId);
  if (!issue.repository || !issue.branch) return { note: "nothing to poll" };
  if (!["investigating", "reproduced", "fixing"].includes(issue.status)) return { note: `status ${issue.status}` };
  const pr = await findPullRequestForBranch("repair", issue.repository, issue.branch);
  if (!pr) {
    const ageMin = (Date.now() - Date.parse(String((issue as unknown as { updated_at: string }).updated_at ?? new Date().toISOString()))) / 60000;
    if (ageMin > 120) {
      await update(repair, issue, "escalated", {}, "No fix pull request after 2 hours");
      return { note: "escalated: no PR" };
    }
    return { next: { step: "poll", delaySeconds: 600 }, note: "waiting for repair PR" };
  }
  if (issue.status === "investigating") await update(repair, issue, "fixing", {});
  const fresh = await loadIssue(repair, issueId);
  await update(repair, fresh, "in_review", { pr_number: pr.number, pr_url: pr.html_url, head_sha: pr.head.sha }, `PR #${pr.number}`);
  return { next: { step: "evaluate", delaySeconds: 600 }, note: `PR #${pr.number} in review` };
}

export async function evaluate(release: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  if (!issue.repository || !issue.pr_number) return { note: "no PR" };
  if (!["in_review", "approved", "awaiting_approval"].includes(issue.status)) return { note: `status ${issue.status}` };
  const repairLogins = (env("BLOOM_GITHUB_REPAIR_LOGINS") ?? "github-actions[bot]").split(",").map((s) => s.trim());
  const { pr, facts } = await pullRequestFacts(issue.repository, issue.pr_number, repairLogins);
  if (pr.merged) return { next: { step: "deploy", delaySeconds: 60 }, note: "already merged" };
  if (pr.state === "closed") {
    await update(release, issue, "failed", {}, "Fix PR was closed without merging");
    return { note: "PR closed" };
  }
  const policy = resolvePolicy(await rpc("setting", { key: "release_policy" }), (await rpc("setting", { key: "auto_release_enabled" })) === true);
  const kinds = issue.tickets.length ? "bug" : "unknown";
  const eligibility = evaluateRelease(policy, {
    kind: kinds as "bug",
    reproduced: !!issue.reproduction?.failing_test || issue.reproduction?.reproduced === true,
    intendedBehaviourEstablished: issue.reproduction?.intended_behaviour_established === true,
    productsTouched: 1,
    labels: [],
    hasProductionVerification: Array.isArray(issue.reproduction?.verification) && (issue.reproduction?.verification as unknown[]).length > 0,
    hasRollback: issue.product !== "unknown",
  }, facts);
  const checksPending = facts.checks.some((c) => c.status !== "completed");
  if (issue.status === "approved") {
    // A person approved; still require green checks and no open threads.
    const hardBlocks = eligibility.reasons.filter((r) => /check|unresolved|requested changes|not mergeable/.test(r));
    if (hardBlocks.length) return { next: { step: "evaluate", delaySeconds: 600 }, note: `approved, waiting: ${hardBlocks.join("; ")}` };
    await update(release, issue, "merging", { eligibility, head_sha: pr.head.sha });
    return await merge(release, issueId, pr.head.sha);
  }
  if (eligibility.eligible) {
    await update(release, issue, "merging", { eligibility, head_sha: pr.head.sha }, "Eligible for automatic release");
    return await merge(release, issueId, pr.head.sha);
  }
  if (checksPending) {
    await update(release, issue, null, { eligibility });
    return { next: { step: "evaluate", delaySeconds: 600 }, note: "checks still running" };
  }
  await update(release, issue, "awaiting_approval", { eligibility }, `Needs review: ${eligibility.reasons.slice(0, 4).join("; ")}`);
  return { note: "awaiting approval" };
}

async function merge(release: Caller, issueId: string, sha: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  try {
    const out = await mergePullRequest(issue.repository!, issue.pr_number!, sha, `fix: ${issue.title} (Bloom ${issue.id.slice(0, 8)})`);
    await update(release, issue, "merged", { merge_sha: out.sha });
  } catch (e) {
    await update(release, issue, "failed", {}, `Merge failed: ${e instanceof Error ? e.message : e}`);
    return { note: "merge failed" };
  }
  const merged = await loadIssue(release, issueId);
  await update(release, merged, "deploying", {});
  return { next: { step: "deploy", delaySeconds: 120 }, note: "merged; tracking deployment" };
}

export async function deploy(release: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  if (!issue.merge_sha || !issue.repository) return { note: "no merge" };
  if (!["merged", "deploying"].includes(issue.status)) return { note: `status ${issue.status}` };
  const base = Object.values(PRODUCT_REPOSITORIES).find((r) => r.repository.toLowerCase() === issue.repository!.toLowerCase())?.base ?? "main";
  if (base !== "main") {
    // e.g. BloomSites: dev is staging; production moves only by a person-authorised dev → main release.
    await update(release, issue, null, { deployment: { state: "awaiting_production_release", base, note: `Merged to ${base}; production release is a person-authorised ${base} → main merge.` } });
    return { next: { step: "deploy", delaySeconds: 3600 }, note: "awaiting person-authorised production release" };
  }
  const dep = await productionDeployment(issue.repository, issue.merge_sha);
  if (dep.state === "pending") {
    const waited = Number(issue.deployment?.polls ?? 0) + 1;
    if (waited > 24) {
      await update(release, issue, "failed", { deployment: { ...dep, polls: waited } }, "Production deployment did not complete within 2 hours");
      return { note: "deployment timeout" };
    }
    await update(release, issue, null, { deployment: { ...dep, polls: waited } });
    return { next: { step: "deploy", delaySeconds: 300 }, note: "deployment pending" };
  }
  if (dep.state === "failure") {
    await update(release, issue, "failed", { deployment: dep }, "Production deployment failed. The previous production deployment is still serving; no rollback was needed.");
    return { note: "deployment failed" };
  }
  await update(release, issue, "deployed", { deployment: dep });
  const deployed = await loadIssue(release, issueId);
  await update(release, deployed, "verifying", {});
  return { next: { step: "verify", delaySeconds: 30 }, note: "deployed" };
}

/**
 * Production verification. Checks come from the reproduction record written
 * during investigation: [{url, expect_status, contains?, not_contains?}].
 */
export async function verify(release: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  if (issue.status !== "verifying") return { note: `status ${issue.status}` };
  const checks = (Array.isArray(issue.reproduction?.verification) ? issue.reproduction!.verification : []) as Array<{ url: string; expect_status?: number; contains?: string; not_contains?: string }>;
  if (!checks.length) {
    await update(release, issue, "escalated", {}, "Deployed, but no production verification is defined — a person must verify");
    return { note: "no checks" };
  }
  const results = [];
  for (const c of checks.slice(0, 10)) {
    try {
      const u = new URL(c.url);
      if (u.protocol !== "https:") throw new Error("https only");
      const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "bloom-support-verifier" } });
      const text = await res.text();
      const pass = res.status === (c.expect_status ?? 200) && (!c.contains || text.includes(c.contains)) && (!c.not_contains || !text.includes(c.not_contains));
      results.push({ url: c.url, status: res.status, pass });
    } catch (e) {
      results.push({ url: c.url, error: String(e).slice(0, 200), pass: false });
    }
  }
  const passed = results.every((r) => r.pass);
  if (passed) {
    await update(release, issue, "verified", { verification: { passed: true, checks: results, at: new Date().toISOString() } });
    return { note: "verified" };
  }
  await update(release, issue, "failed", { verification: { passed: false, checks: results, at: new Date().toISOString() } },
    "Production verification failed after release. Roll back with the hosting provider's instant rollback to the previous production deployment, then decide.");
  return { note: "verification failed" };
}
