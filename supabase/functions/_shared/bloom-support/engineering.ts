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
import { promotionObservationSchedule, type EngineeringNext } from "./engineering-schedule.ts";
import { BloomError, type Caller, env, readResponseText, rpc } from "./runtime.ts";
import { evaluateRelease, PRODUCT_REPOSITORIES, redactForEngineering, resolvePolicy, type Product } from "./policy.ts";
import { commitContains, findPullRequestForBranch, gh, GitHubError, mergePullRequest, productionCommitForRepair, productionDeployment, pullRequestFacts } from "./github.ts";

export interface EngineeringIssue {
  id: string; title: string; product: Product; repository: string | null; status: string; version: number;
  evidence: Record<string, unknown>; reproduction: Record<string, unknown> | null; branch: string | null;
  pr_number: number | null; pr_url: string | null; head_sha: string | null; merge_sha: string | null;
  deployment: Record<string, unknown> | null; verification: Record<string, unknown> | null; eligibility: Record<string, unknown> | null;
  rollback?: {
    previous_deployment_id?: string;
    previous_url?: string;
    provider?: string;
    status?: string;
    requested_at?: string;
    polls?: number;
  } | null;
  attempts: number; approved_head_sha?: string | null;
  tickets: Array<{ id: string; number: number; subject: string; account_id: string | null; status: string }>;
}

export type StepResult = { next?: EngineeringNext; note: string };

async function loadIssue(actor: Caller, id: string): Promise<EngineeringIssue> {
  const all = await rpc<EngineeringIssue[]>("list_engineering", { actor: actor.principalId });
  const issue = all.find((e) => e.id === id);
  if (!issue) throw new BloomError(404, "not_found", "engineering issue");
  return issue;
}

async function update(actor: Caller, issue: EngineeringIssue, status: string | null, patch: Record<string, unknown>, note?: string) {
  return await rpc("update_engineering_issue", { actor: actor.principalId, issue_id: issue.id, update: { ...(status ? { status } : {}), patch, note } });
}

async function updateVersioned(
  actor: Caller,
  issue: EngineeringIssue,
  status: string | null,
  patch: Record<string, unknown>,
  note?: string,
) {
  return await rpc("update_engineering_issue", {
    actor: actor.principalId,
    issue_id: issue.id,
    update: { version: issue.version, ...(status ? { status } : {}), patch, note },
  });
}

export function branchFor(issueId: string): string {
  return `bloom/fix-${issueId.slice(0, 8)}`;
}

function hasExplicitPort(raw: string): boolean {
  const authority = raw.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return host.startsWith("[") ? /\]:\d+$/.test(host) : /:\d+$/.test(host);
}

function isPrivateVerificationHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /\.(?:local|internal|home|lan)$/.test(host)
  ) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224;
  }
  return host === "::" || host === "::1" ||
    /^(?:fc|fd|fe[89ab])/.test(host) ||
    host.startsWith("::ffff:127.") || host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.");
}

/** Canonical HTTPS URL on a repository's trusted production-origin allowlist. */
export function approvedVerificationUrl(
  releasePolicy: unknown,
  repository: string,
  value: unknown,
): string | null {
  if (typeof value !== "string" || !value || hasExplicitPort(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      url.search || url.hash || isPrivateVerificationHost(url.hostname)
    ) return null;
    const policy = releasePolicy && typeof releasePolicy === "object"
      ? releasePolicy as Record<string, unknown>
      : {};
    const maps = policy.verificationOrigins;
    const configured = maps && typeof maps === "object"
      ? (maps as Record<string, unknown>)[repository]
      : null;
    const approved = Array.isArray(configured) && configured.some((origin) => {
      if (typeof origin !== "string" || hasExplicitPort(origin)) return false;
      try {
        const allowed = new URL(origin);
        return allowed.protocol === "https:" && !allowed.username &&
          !allowed.password && !allowed.port && !allowed.search &&
          !allowed.hash && allowed.pathname === "/" &&
          !isPrivateVerificationHost(allowed.hostname) &&
          allowed.origin === url.origin;
      } catch {
        return false;
      }
    });
    return approved ? `${url.origin}${url.pathname}` : null;
  } catch {
    return null;
  }
}

interface VerificationCheck {
  url: string;
  expect_status?: number;
  contains?: string;
  not_contains?: string;
}

interface TicketFlowRule {
  pathPrefix: string;
  checks: VerificationCheck[];
}

function validatedVerificationChecks(
  releasePolicy: unknown,
  repository: string,
  raw: unknown,
): VerificationCheck[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) return null;
  const checks: VerificationCheck[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const check = item as Record<string, unknown>;
    const url = approvedVerificationUrl(releasePolicy, repository, check.url);
    if (!url) return null;
    if (
      check.expect_status !== undefined &&
      (!Number.isInteger(check.expect_status) ||
        (check.expect_status as number) < 100 ||
        (check.expect_status as number) > 599)
    ) return null;
    for (const key of ["contains", "not_contains"] as const) {
      if (
        check[key] !== undefined &&
        (typeof check[key] !== "string" || (check[key] as string).length > 500)
      ) return null;
    }
    checks.push({
      url,
      ...(check.expect_status !== undefined
        ? { expect_status: check.expect_status as number }
        : {}),
      ...(typeof check.contains === "string" ? { contains: check.contains } : {}),
      ...(typeof check.not_contains === "string"
        ? { not_contains: check.not_contains }
        : {}),
    });
  }
  return checks;
}

/** Release-owned, fully validated production checks; agent reports cannot add URLs. */
export function verificationChecksForPolicy(
  releasePolicy: unknown,
  repository: string,
): VerificationCheck[] | null {
  const policy = releasePolicy && typeof releasePolicy === "object"
    ? releasePolicy as Record<string, unknown>
    : {};
  const maps = policy.verificationChecks;
  const raw = maps && typeof maps === "object"
    ? (maps as Record<string, unknown>)[repository]
    : null;
  return validatedVerificationChecks(releasePolicy, repository, raw);
}

function ticketFlowRulesForPolicy(
  releasePolicy: unknown,
  repository: string,
): TicketFlowRule[] | null {
  const policy = releasePolicy && typeof releasePolicy === "object"
    ? releasePolicy as Record<string, unknown>
    : {};
  const maps = policy.ticketFlowChecks;
  const raw = maps && typeof maps === "object"
    ? (maps as Record<string, unknown>)[repository]
    : null;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return null;
  const rules: TicketFlowRule[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const rule = item as Record<string, unknown>;
    const pathPrefix = typeof rule.path_prefix === "string" ? rule.path_prefix : "";
    if (
      !pathPrefix.startsWith("/") || pathPrefix.length > 500 ||
      pathPrefix.includes("?") || pathPrefix.includes("#") ||
      pathPrefix.includes("\\") || pathPrefix.includes("//") ||
      /(?:^|\/)\.\.?(?:\/|$)/.test(pathPrefix) ||
      /%(?:2e|2f|5c)/i.test(pathPrefix)
    ) return null;
    const canonicalPrefix = pathPrefix.length > 1
      ? pathPrefix.replace(/\/+$/, "")
      : pathPrefix;
    if (seen.has(canonicalPrefix)) return null;
    seen.add(canonicalPrefix);
    const checks = validatedVerificationChecks(
      releasePolicy,
      repository,
      rule.checks,
    );
    if (!checks) return null;
    rules.push({ pathPrefix: canonicalPrefix, checks });
  }
  return rules.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
}

export function hasTicketFlowChecksForPolicy(
  releasePolicy: unknown,
  repository: string,
): boolean {
  return ticketFlowRulesForPolicy(releasePolicy, repository) !== null;
}

/**
 * Select trusted affected-flow checks from a ticket's captured page URL.
 * The ticket contributes only an approved production origin and a canonical
 * pathname; every URL and assertion executed still comes from release policy.
 */
export function ticketFlowChecksForPolicy(
  releasePolicy: unknown,
  repository: string,
  affectedPageUrl: unknown,
): { path: string; checks: VerificationCheck[] } | null {
  if (typeof affectedPageUrl !== "string" || hasExplicitPort(affectedPageUrl)) return null;
  let affected: URL;
  try {
    affected = new URL(affectedPageUrl);
  } catch {
    return null;
  }
  if (
    affected.protocol !== "https:" || affected.username || affected.password ||
    affected.port || /%(?:2e|2f|5c)/i.test(affected.pathname)
  ) return null;
  const approvedPath = approvedVerificationUrl(
    releasePolicy,
    repository,
    `${affected.origin}${affected.pathname}`,
  );
  if (!approvedPath) return null;
  const rules = ticketFlowRulesForPolicy(releasePolicy, repository);
  if (!rules) return null;
  const path = new URL(approvedPath).pathname;
  const rule = rules.find(({ pathPrefix }) =>
    pathPrefix === "/" || path === pathPrefix || path.startsWith(`${pathPrefix}/`)
  );
  return rule ? { path, checks: rule.checks } : null;
}

function repoFor(issue: EngineeringIssue): { repository: string; base: string } | null {
  if (issue.repository) {
    const known = Object.values(PRODUCT_REPOSITORIES).find((r) => r.repository.toLowerCase() === issue.repository!.toLowerCase());
    return { repository: issue.repository, base: known?.base ?? "main" };
  }
  const m = PRODUCT_REPOSITORIES[issue.product as keyof typeof PRODUCT_REPOSITORIES];
  return m ? { repository: m.repository, base: m.base } : null;
}

function engineeringPagePath(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.pathname
      .split("/")
      .map((part) => /^[0-9a-f-]{32,}$/i.test(part) || /^\d{7,}$/.test(part) ? "[record]" : part)
      .join("/")
      .slice(0, 1000);
  } catch {
    return redactForEngineering(value).split(/[?#]/, 1)[0].slice(0, 1000);
  }
}

function engineeringContext(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    page_path: engineeringPagePath(raw.page_url),
    app_version: raw.app_version ?? raw.release,
    browser: typeof (raw.browser ?? raw.user_agent) === "string"
      ? redactForEngineering(String(raw.browser ?? raw.user_agent)).slice(0, 500)
      : null,
    error_ids: raw.error_ids,
    trace_ids: raw.trace_ids,
  };
}

export function engineeringIssuePayload(input: {
  issueId: string;
  title: string;
  branch: string;
  base: string;
  evidence: string;
}): { title: string; body: string; labels: string[] } {
  const body = [
    `Bloom engineering issue \`${input.issueId}\`. Fix branch: \`${input.branch}\` → \`${input.base}\`.`,
    "",
    "Reports (sanitized; client contact details removed):",
    "",
    input.evidence,
    "",
    "Repair rules: reproduce first with a focused failing test, fix the root cause, never weaken or delete existing tests,",
    "never edit workflows, release policy, migrations, auth, payments or secrets. If the fix needs any of those, stop and say so.",
  ].join("\n");
  // Final defence at the exact outbound boundary. Even if a future evidence
  // collector forgets to sanitize one field, GitHub never receives it.
  return {
    title: `[Bloom] ${redactForEngineering(input.title)}`.slice(0, 250),
    body: redactForEngineering(body),
    labels: ["bloom-repair"],
  };
}

/** Evidence for the coding agent: sanitized summaries only, no client contact data. */
async function evidenceFor(automation: Caller, issue: EngineeringIssue): Promise<string> {
  const parts: string[] = [];
  for (const t of issue.tickets.slice(0, 5)) {
    const full = await rpc<Record<string, unknown>>("get_ticket", { actor: automation.principalId, ticket_id: t.id });
    const ctx = (full.context ?? {}) as Record<string, unknown>;
    parts.push([
      `### Report #${t.number}: ${redactForEngineering(String(full.subject ?? ""))}`,
      redactForEngineering(String(full.summary ?? "")).slice(0, 3000),
      `Context: ${JSON.stringify(engineeringContext(ctx)).slice(0, 1500)}`,
    ].join("\n"));
  }
  return parts.join("\n\n");
}

/**
 * Starts the repair workflow. A GitHub-side error (5xx) is retried once, but only after
 * confirming GitHub did not start a run anyway, so a glitch never produces two repairs.
 */
async function repairWorkflowRunExists(
  repository: string,
  workflow: string,
  issueId: string,
  startedAt: string,
): Promise<boolean> {
  const runs = await gh<{ workflow_runs?: Array<{ display_title?: string }> }>(
    "repair",
    "GET",
    `/repos/${repository}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=100&created=${encodeURIComponent(`>=${startedAt}`)}`,
  );
  return (runs.workflow_runs ?? []).some((run) => (run.display_title ?? "").includes(issueId));
}

async function dispatchWithRetry(
  repository: string,
  workflow: string,
  payload: { ref: string; inputs: Record<string, string> },
  startedAt: string,
): Promise<void> {
  const issueId = payload.inputs.engineering_issue_id;
  const path = `/repos/${repository}/actions/workflows/${workflow}/dispatches`;
  if (await repairWorkflowRunExists(repository, workflow, issueId, startedAt)) return;
  try {
    await gh("repair", "POST", path, payload);
    return;
  } catch (e) {
    if (!(e instanceof GitHubError) || e.upstream < 500) throw e;
  }
  await new Promise((r) => setTimeout(r, Number(env("BLOOM_GITHUB_RETRY_DELAY_MS") ?? 5000)));
  if (await repairWorkflowRunExists(repository, workflow, issueId, startedAt)) return;
  await gh("repair", "POST", path, payload);
}

export async function investigate(repair: Caller, automation: Caller, issueId: string): Promise<StepResult> {
  let issue = await loadIssue(repair, issueId);
  const workflow = env("BLOOM_REPAIR_WORKFLOW") ?? "bloom-repair.yml";
  const dispatchLeaseMs = 20 * 60 * 1000;
  const dispatchClaimUntil = (now = Date.now()) => new Date(now + dispatchLeaseMs).toISOString();
  const pendingDispatch = issue.status === "investigating" && issue.evidence?.dispatch_pending === true;
  if (pendingDispatch) {
    const leaseUntil = Date.parse(String(issue.evidence.dispatch_claim_until ?? ""));
    if (Number.isFinite(leaseUntil) && leaseUntil > Date.now()) {
      return {
        next: { step: "investigate", delaySeconds: Math.ceil((leaseUntil - Date.now()) / 1000) },
        note: "repair dispatch is claimed; waiting to reconcile it",
      };
    }
    const startedAt = typeof issue.evidence.dispatch_started_at === "string"
      ? issue.evidence.dispatch_started_at
      : new Date(Date.now() - 120_000).toISOString();
    await updateVersioned(repair, issue, null, { evidence: { dispatch_claim_until: dispatchClaimUntil() } });
    issue = await loadIssue(repair, issueId);
    const target = repoFor(issue);
    if (!target) {
      await update(repair, issue, "escalated", {}, "Product unknown: Bloom cannot map this report to a repository");
      return { note: "escalated: unknown product" };
    }
    return await continueRepairDispatch(repair, automation, issue, target, workflow, startedAt);
  }
  // A queued duplicate observes an existing dispatch or repair run; it never
  // spends another attempt. Pending dispatches above are reconciled explicitly.
  if (["investigating", "reproduced", "fixing"].includes(issue.status)) {
    return { next: { step: "poll", delaySeconds: 300 }, note: "repair already running; observing existing run" };
  }
  if (issue.reproduction?.needs_human === true && ["open", "failed", "not_reproduced"].includes(issue.status)) {
    await update(repair, issue, "escalated", {}, "Automatic repair requires human review. Repeating Start repair cannot clear this stop. Admin: take ownership, review the recorded reason, and continue through an authorized engineering path with existing release holds intact.");
    return { note: "human review required; no repair dispatched" };
  }
  if (!["open", "not_reproduced", "failed"].includes(issue.status)) return { note: `already ${issue.status}` };
  const target = repoFor(issue);
  if (!target) {
    await update(repair, issue, "escalated", {}, "Product unknown: Bloom cannot map this report to a repository");
    return { note: "escalated: unknown product" };
  }
  // Bounded attempts and a global cap on concurrent repairs.
  const cap = await rpc<{ active: number; max_active: number; attempts: number; max_attempts: number }>("repair_capacity", { issue_id: issue.id });
  if (cap.attempts >= cap.max_attempts) {
    await update(repair, issue, "escalated", {}, `Repair attempts exhausted (${cap.attempts}/${cap.max_attempts}); a person must take this bug`);
    return { note: "escalated: attempts exhausted" };
  }
  if (cap.active >= cap.max_active) return { next: { step: "investigate", delaySeconds: 1800 }, note: `waiting for repair capacity (${cap.active}/${cap.max_active} active)` };
  const branch = branchFor(issue.id);
  // Claim the issue and the dispatch phase with its database version before
  // any GitHub mutation. A reclaimed job can reconcile workflow-run evidence.
  const startedAt = new Date().toISOString();
  await updateVersioned(repair, issue, "investigating", {
    repository: target.repository,
    branch,
    evidence: {
      dispatches: cap.attempts + 1,
      dispatch_pending: true,
      dispatch_started_at: startedAt,
      dispatch_claim_until: dispatchClaimUntil(),
    },
  }, `Starting repair attempt ${cap.attempts + 1}/${cap.max_attempts}`);
  issue = await loadIssue(repair, issueId);
  return await continueRepairDispatch(repair, automation, issue, target, workflow, startedAt);
}

async function continueRepairDispatch(
  repair: Caller,
  automation: Caller,
  issue: EngineeringIssue,
  target: { repository: string; base: string },
  workflow: string,
  startedAt: string,
): Promise<StepResult> {
  try {
    if (await repairWorkflowRunExists(target.repository, workflow, issue.id, startedAt)) {
      await updateVersioned(repair, issue, null, {
        evidence: { dispatch_pending: false, dispatch_claim_until: null, dispatched_at: new Date().toISOString() },
      }, "Existing repair workflow run reconciled");
      return { next: { step: "poll", delaySeconds: 300 }, note: "existing repair workflow run found; observing it" };
    }

    const evidence = await evidenceFor(automation, issue);
    let ghIssue = (issue.evidence?.github_issue as { number: number; url: string } | undefined) ?? null;
    if (!ghIssue) {
      const created = await gh<{ number: number; html_url: string }>(
        "repair", "POST", `/repos/${target.repository}/issues`,
        engineeringIssuePayload({ issueId: issue.id, title: issue.title, branch: issue.branch ?? branchFor(issue.id), base: target.base, evidence }),
      );
      ghIssue = { number: created.number, url: created.html_url };
      await updateVersioned(repair, issue, null, { evidence: { github_issue: ghIssue } }, `GitHub issue #${ghIssue.number}`);
      issue = await loadIssue(repair, issue.id);
    }
    // The repair workflow only runs from the repository's default branch (it checks
    // github.ref). The fix still targets target.base, which travels as an input.
    const { default_branch } = await gh<{ default_branch: string }>("repair", "GET", `/repos/${target.repository}`);
    await dispatchWithRetry(target.repository, workflow, {
      ref: default_branch,
      inputs: { github_issue: String(ghIssue.number), engineering_issue_id: issue.id, branch: issue.branch ?? branchFor(issue.id), base: target.base },
    }, startedAt);
    const latest = await loadIssue(repair, issue.id);
    await updateVersioned(repair, latest, null, {
      evidence: { dispatch_pending: false, dispatch_claim_until: null, dispatched_at: new Date().toISOString() },
    }, "Repair workflow dispatch confirmed");
  } catch (e) {
    if (e instanceof BloomError && e.code === "conflict") throw e;
    const latest = await loadIssue(repair, issue.id);
    if (latest.status !== "investigating" || latest.evidence?.dispatch_pending !== true) {
      return { note: "repair state changed before workflow dispatch completed" };
    }
    await updateVersioned(repair, latest, "escalated", {
      evidence: { dispatch_pending: false, dispatch_claim_until: null },
    }, `Repair workflow could not start in ${target.repository}: ${e instanceof Error ? e.message : e}`);
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

export async function evaluate(
  release: Caller,
  issueId: string,
  options: { humanOwned?: boolean } = {},
): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  if (!issue.repository || !issue.pr_number) return { note: "no PR" };
  if (!["in_review", "approved", "awaiting_approval"].includes(issue.status)) return { note: `status ${issue.status}` };
  const repairLogins = (env("BLOOM_GITHUB_REPAIR_LOGINS") ?? "github-actions[bot]").split(",").map((s) => s.trim());
  const { pr, facts } = await pullRequestFacts(issue.repository, issue.pr_number, repairLogins);
  if (pr.merged) {
    const mergeSha = pr.merge_commit_sha?.trim();
    if (!mergeSha) {
      return { next: { step: "evaluate", delaySeconds: 60 }, note: "merged; waiting for GitHub merge commit" };
    }
    const target = repoFor(issue);
    // A dev-base merge is not production. Its rollback point must be captured
    // later, immediately before/at the proven main promotion; recording here
    // could roll back unrelated good releases made in between.
    const rollbackReady = target?.base === "main"
      ? await recordPreviousProductionDeployment(
        release,
        issue,
        [mergeSha],
        [mergeSha, pr.head.sha],
      )
      : true;
    if (!rollbackReady) {
      await update(
        release,
        issue,
        "escalated",
        { merge_sha: mergeSha, head_sha: pr.head.sha },
        "Pull request was already merged, but Bloom could not prove which prior production deployment is safe to restore. A person must verify the release and rollback point.",
      );
      return { note: "merged; rollback point could not be proven" };
    }
    // A person may merge an approved PR before Bloom's next evaluation. Persist
    // the same release facts as the automated merge path before deployment.
    await update(release, issue, "merged", { merge_sha: mergeSha, head_sha: pr.head.sha }, "Pull request was merged outside Bloom; continuing release tracking");
    const merged = await loadIssue(release, issueId);
    await update(release, merged, "deploying", {});
    return { next: { step: "deploy", delaySeconds: 60 }, note: "existing merge recorded; tracking deployment" };
  }
  if (pr.state === "closed") {
    await update(release, issue, "failed", {}, "Fix PR was closed without merging");
    return { note: "PR closed" };
  }
  // Under human ownership, evaluate only a permission-checked approval.
  // Existing merges are handled above so deployment monitoring is never lost.
  if (options.humanOwned && (issue.status !== "approved" || !issue.approved_head_sha)) {
    return { note: "human owns engineering review; automatic release decision held" };
  }
  // A delayed repair report can arrive after polling has already moved the
  // issue into review. Never let its explicit human-review signal be bypassed
  // by automatic eligibility or an approval that predates that report. The
  // report RPC clears the old approval binding, so a later person approval of
  // the current head remains an intentional override.
  if (issue.reproduction?.needs_human === true &&
    (issue.status !== "approved" || !issue.approved_head_sha)) {
    const eligibility = {
      eligible: false,
      reasons: ["repair report requires human review"],
    };
    if (issue.status !== "awaiting_approval") {
      await update(
        release,
        issue,
        "awaiting_approval",
        { eligibility },
        "The repair report requires human review before this pull request can merge",
      );
    } else {
      await update(release, issue, null, { eligibility });
    }
    return { note: "awaiting approval: repair report requires human review" };
  }
  const releasePolicy = await rpc("setting", { key: "release_policy" });
  const policy = resolvePolicy(releasePolicy, (await rpc("setting", { key: "auto_release_enabled" })) === true);
  const kinds = issue.tickets.length ? "bug" : "unknown";
  // Automatic rollback exists only where Bloom can redeploy the previous production build.
  const rollbackTarget = await vercelTarget(issue.repository);
  const eligibility = evaluateRelease(policy, {
    kind: kinds as "bug",
    reproduced: !!issue.reproduction?.failing_test || issue.reproduction?.reproduced === true,
    intendedBehaviourEstablished: issue.reproduction?.intended_behaviour_established === true,
    productsTouched: 1,
    labels: [],
    hasProductionVerification: verificationChecksForPolicy(
      releasePolicy,
      issue.repository!,
    ) !== null,
    hasRollback: rollbackTarget !== null,
  }, facts);
  const checksPending = facts.checks.some((c) => c.status !== "completed");
  if (issue.status === "approved") {
    // A person approved; still require green checks and no open threads.
    // Jon's approval replaces the policy's area/size/review limits, never CI: every existing check
    // must be complete and green, no review may request changes, and no thread may be open.
    const hardBlocks = eligibility.reasons.filter((r) => /required check (missing|not green)|no required checks configured|a check failed|unresolved|requested changes|not mergeable|empty change|no production verification|no supported rollback/.test(r));
    // The approval covers exactly the commit Jon reviewed. A new push needs a new approval.
    if (issue.approved_head_sha && issue.approved_head_sha !== pr.head.sha) {
      await update(release, issue, "awaiting_approval", { eligibility, head_sha: pr.head.sha }, "The pull request changed after approval; it needs approving again");
      return { note: "re-approval needed" };
    }
    if (checksPending) hardBlocks.push("checks still running");
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

interface VercelTarget { projectId: string; teamId?: string }
async function vercelTarget(repository: string): Promise<VercelTarget | null> {
  const policy = (await rpc<Record<string, unknown> | null>("setting", { key: "release_policy" })) ?? {};
  const map = (policy.vercel ?? {}) as Record<string, VercelTarget>;
  return env("BLOOM_VERCEL_TOKEN") && map[repository]?.projectId ? map[repository] : null;
}
async function vercel<T>(method: string, path: string, target: VercelTarget): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.vercel.com${path}${target.teamId ? `${sep}teamId=${target.teamId}` : ""}`, {
    method, headers: { Authorization: `Bearer ${env("BLOOM_VERCEL_TOKEN")}` }, signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new BloomError(502, "vercel_error", `Vercel ${method} ${path}: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const body = await readResponseText(res, 2 * 1024 * 1024);
  return (body ? JSON.parse(body) : undefined) as T;
}

interface VercelDeployment {
  uid: string;
  url: string;
  meta?: Record<string, unknown>;
  readyState?: string;
}

interface VercelProjectAlias {
  target?: string;
  redirect?: string | null;
  deployment?: {
    id?: string;
    uid?: string;
    url?: string;
    meta?: Record<string, unknown>;
    readyState?: string;
  } | null;
}

function vercelDeploymentCommit(deployment: VercelDeployment): string | null {
  for (const key of ["githubCommitSha", "gitCommitSha", "commitSha"]) {
    const value = deployment.meta?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function projectAliasDeployment(alias: VercelProjectAlias): VercelDeployment | null {
  const deployment = alias.deployment;
  const uid = deployment?.uid ?? deployment?.id;
  if (!deployment || !uid || !deployment.url || deployment.readyState !== "READY") return null;
  return {
    uid,
    url: deployment.url,
    meta: deployment.meta,
    readyState: deployment.readyState,
  };
}

async function deploymentContainsAny(
  repository: string,
  deployment: VercelDeployment,
  forbiddenAncestorShas: string[],
  excluded: Set<string>,
): Promise<boolean | null> {
  const sha = vercelDeploymentCommit(deployment);
  if (!sha) return null;
  if (excluded.has(sha.toLowerCase())) return true;
  for (const marker of forbiddenAncestorShas) {
    if (await commitContains(repository, marker, sha)) return true;
  }
  return false;
}

/** Record only a deployment whose commit metadata proves it predates this fix. */
async function recordPreviousProductionDeployment(
  release: Caller,
  issue: EngineeringIssue,
  forbiddenAncestorShas: string[],
  excludeShas: string[],
  replaceExisting = false,
): Promise<boolean> {
  const target = await vercelTarget(issue.repository!);
  if (!target) return true;
  if (issue.rollback?.previous_deployment_id && !replaceExisting) return true;
  const excluded = new Set(excludeShas.map((sha) => sha.toLowerCase()));
  try {
    // READY deployment history is not authoritative: a failed deployment stays
    // READY after its aliases are rolled back. First prove which deployment is
    // serving every production alias, then consider only that deployment or
    // older history if the repair is already live.
    const project = await vercel<{ alias?: VercelProjectAlias[] }>(
      "GET",
      `/v9/projects/${encodeURIComponent(target.projectId)}`,
      target,
    );
    const productionAliases = (project.alias ?? []).filter((alias) =>
      alias.target?.toUpperCase() === "PRODUCTION" && !alias.redirect
    );
    if (productionAliases.length === 0) return false;
    const servingDeployments = productionAliases.map(projectAliasDeployment);
    if (servingDeployments.some((deployment) => deployment === null)) return false;
    const serving = servingDeployments[0]!;
    if (servingDeployments.some((deployment) => deployment!.uid !== serving.uid)) return false;

    const list = await vercel<{ deployments: VercelDeployment[] }>(
      "GET",
      `/v6/deployments?projectId=${encodeURIComponent(target.projectId)}&target=production&state=READY&limit=20`,
      target,
    );
    const servingUnsafe = await deploymentContainsAny(
      issue.repository!,
      serving,
      forbiddenAncestorShas,
      excluded,
    );
    if (servingUnsafe === null) return false;

    let previous: VercelDeployment | undefined = servingUnsafe ? undefined : serving;
    if (!previous) {
      const servingIndex = list.deployments.findIndex((deployment) => deployment.uid === serving.uid);
      // When the repair is already serving, only deployments older than the
      // current alias target can be rollback candidates. Newer READY history
      // may be failed releases whose aliases were already moved away.
      if (servingIndex < 0) return false;
      for (const deployment of list.deployments.slice(servingIndex + 1)) {
        const unsafe = await deploymentContainsAny(
          issue.repository!,
          deployment,
          forbiddenAncestorShas,
          excluded,
        );
        if (unsafe === false) {
          previous = deployment;
          break;
        }
      }
    }
    if (!previous) return false;
    await update(release, issue, null, {
      rollback: {
        previous_deployment_id: previous.uid,
        previous_url: previous.url,
        previous_commit_sha: vercelDeploymentCommit(previous),
        provider: "vercel",
      },
    });
    return true;
  } catch (error) {
    console.warn("could not prove previous deployment", String(error));
    return false;
  }
}

async function merge(release: Caller, issueId: string, sha: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  const base = repoFor(issue)?.base ?? "main";
  if (base === "main" && !(await recordPreviousProductionDeployment(release, issue, [sha], [sha]))) {
    await update(
      release,
      issue,
      "escalated",
      {},
      "Bloom could not prove which production deployment is safe to restore, so it did not merge automatically.",
    );
    return { note: "merge blocked: rollback point could not be proven" };
  }
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
  const observationStartedAt = Date.now();
  const issue = await loadIssue(release, issueId);
  if (!issue.merge_sha || !issue.repository) return { note: "no merge" };
  if (!["merged", "deploying"].includes(issue.status)) return { note: `status ${issue.status}` };
  const base = Object.values(PRODUCT_REPOSITORIES).find((r) => r.repository.toLowerCase() === issue.repository!.toLowerCase())?.base ?? "main";
  let deploymentSha = issue.merge_sha;
  let promotion: Record<string, unknown> = {};
  if (base !== "main") {
    // e.g. BloomSites: dev is staging; production moves only by a person-authorised
    // dev → main release. Bloom observes that promotion but never performs it.
    const productionSha = await productionCommitForRepair(
      issue.repository,
      issue.merge_sha,
      base,
    );
    if (!productionSha) {
      // Observe promptly without changing who may promote the release. Keep
      // promotion attempts separate from the production deployment timeout:
      // waiting for a person must never consume the deployment's 24 polls.
      const { polls: promotionPolls, delaySeconds, runAfter } = promotionObservationSchedule(
        issue.deployment?.promotion_polls, observationStartedAt,
      );
      await update(release, issue, null, { deployment: { state: "awaiting_production_release", base, source_merge_sha: issue.merge_sha, promotion_polls: promotionPolls, note: `Merged to ${base}; production release is a person-authorised ${base} → main merge.` } });
      return { next: { step: "deploy", delaySeconds, runAfter }, note: "awaiting person-authorised production release" };
    }
    deploymentSha = productionSha;
    promotion = { source_merge_sha: issue.merge_sha, production_sha: productionSha, promoted_from: base, production_branch: "main" };
    // Refresh at the observed promotion and use the production SHA as the
    // ancestry marker. This rejects both the promotion deployment and every
    // later production descendant while selecting the newest proven-safe build.
    if (!(await recordPreviousProductionDeployment(
      release,
      issue,
      [issue.merge_sha, productionSha],
      [issue.merge_sha, productionSha],
      true,
    ))) {
      await update(
        release,
        issue,
        "escalated",
        { deployment: { ...promotion, state: "rollback_point_unproven" } },
        "Production promotion was found, but Bloom could not prove which immediately prior deployment is safe to restore. A person must verify the release and rollback point.",
      );
      return { note: "promotion found; rollback point could not be proven" };
    }
  } else if (!(await recordPreviousProductionDeployment(
    release,
    issue,
    [issue.merge_sha],
    [issue.merge_sha],
    true,
  ))) {
    // Re-prove this immediately before tracking production. Another person may
    // have shipped a good release after Bloom's pre-merge snapshot; rolling
    // back past that release would remove unrelated good work.
    await update(
      release,
      issue,
      "escalated",
      { deployment: { state: "rollback_point_unproven", production_sha: issue.merge_sha } },
      "Bloom could not prove the newest safe production deployment immediately before this release. A person must verify the release and rollback point.",
    );
    return { note: "deployment blocked: rollback point could not be proven" };
  }
  const dep = await productionDeployment(issue.repository, deploymentSha);
  if (dep.state === "pending") {
    const waited = Number(issue.deployment?.polls ?? 0) + 1;
    if (waited > 24) {
      await update(release, issue, "failed", { deployment: { ...dep, ...promotion, polls: waited } }, "Production deployment did not complete within 2 hours");
      return { note: "deployment timeout" };
    }
    await update(release, issue, null, { deployment: { ...dep, ...promotion, polls: waited } });
    return { next: { step: "deploy", delaySeconds: 300 }, note: "deployment pending" };
  }
  if (dep.state === "failure") {
    await update(release, issue, "failed", { deployment: { ...dep, ...promotion } }, "Production deployment failed. The previous production deployment is still serving; no rollback was needed.");
    return { note: "deployment failed" };
  }
  await update(release, issue, "deployed", { deployment: { ...dep, ...promotion } });
  const deployed = await loadIssue(release, issueId);
  await update(release, deployed, "verifying", {});
  return { next: { step: "verify", delaySeconds: 30 }, note: "deployed" };
}

async function runProductionChecks(
  releasePolicy: unknown,
  repository: string,
  checks: VerificationCheck[],
) {
  const results = [];
  for (const c of checks) {
    let resultUrl = "[rejected]";
    try {
      const safeUrl = approvedVerificationUrl(releasePolicy, repository, c.url);
      if (!safeUrl) throw new Error("URL is not an approved production target");
      resultUrl = safeUrl;
      const res = await fetch(safeUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "bloom-support-verifier" },
      });
      const text = await readResponseText(res, 1024 * 1024);
      const pass = res.status === (c.expect_status ?? 200) &&
        (!c.contains || text.includes(c.contains)) &&
        (!c.not_contains || !text.includes(c.not_contains));
      results.push({ url: safeUrl, status: res.status, pass });
    } catch (e) {
      results.push({
        url: resultUrl,
        error: String(e).slice(0, 200),
        pass: false,
      });
    }
  }
  return results;
}

interface TicketFlowVerification {
  attempted: boolean;
  passed: boolean;
  ticketIds: string[];
  checks: Array<Record<string, unknown>>;
  flows: Array<Record<string, unknown>>;
}

async function runTicketFlowVerification(
  release: Caller,
  issue: EngineeringIssue,
  releasePolicy: unknown,
): Promise<TicketFlowVerification> {
  const verifiedTicketIds: string[] = [];
  const flatChecks: Array<Record<string, unknown>> = [];
  const flows: Array<Record<string, unknown>> = [];
  const cached = new Map<string, Array<Record<string, unknown>>>();
  let attempted = false;
  let passed = true;
  let checkBudget = 20;

  // One issue can link many duplicate reports. Bound remote work and reuse an
  // identical trusted flow check across every ticket on the same affected path.
  for (const linked of issue.tickets.slice(0, 50)) {
    let ticket: { id?: string; kind?: string; context?: { page_url?: unknown } };
    try {
      ticket = await rpc<typeof ticket>("get_ticket", {
        actor: release.principalId,
        ticket_id: linked.id,
      });
    } catch {
      flows.push({ ticket_id: linked.id, passed: false, skipped: "ticket_unavailable" });
      continue;
    }
    if (!ticket || !["bug", "incident"].includes(String(ticket.kind))) {
      flows.push({ ticket_id: linked.id, passed: false, skipped: "not_bug_or_incident" });
      continue;
    }
    const selected = ticketFlowChecksForPolicy(
      releasePolicy,
      issue.repository!,
      ticket.context?.page_url,
    );
    if (!selected) {
      flows.push({ ticket_id: linked.id, passed: false, skipped: "no_trusted_flow_check" });
      continue;
    }
    const cacheKey = JSON.stringify(selected.checks);
    let flowResults = cached.get(cacheKey);
    if (!flowResults) {
      if (selected.checks.length > checkBudget) {
        flows.push({ ticket_id: linked.id, path: selected.path, passed: false, skipped: "verification_budget" });
        continue;
      }
      checkBudget -= selected.checks.length;
      flowResults = await runProductionChecks(
        releasePolicy,
        issue.repository!,
        selected.checks,
      ) as Array<Record<string, unknown>>;
      cached.set(cacheKey, flowResults);
    }
    attempted = true;
    const flowPassed = flowResults.every((result) => result.pass === true);
    passed = passed && flowPassed;
    if (flowPassed) verifiedTicketIds.push(linked.id);
    const ticketChecks = flowResults.map((result) => ({
      ...result,
      ticket_id: linked.id,
      flow_path: selected.path,
      check_scope: "ticket_flow",
    }));
    flatChecks.push(...ticketChecks);
    flows.push({
      ticket_id: linked.id,
      path: selected.path,
      passed: flowPassed,
      checks: ticketChecks,
    });
  }
  return { attempted, passed, ticketIds: verifiedTicketIds, checks: flatChecks, flows };
}

type RollbackConfirmation =
  | { state: "pending"; polls: number }
  | { state: "failed"; reason: string; polls: number }
  | { state: "confirmed"; polls: number; aliases: number };

/**
 * Vercel's rollback POST only accepts the request. Confirm the provider's
 * alias job targets the recorded deployment and that every production alias
 * finished mapping before claiming traffic is restored.
 */
async function confirmVercelRollback(
  target: VercelTarget,
  rollback: NonNullable<EngineeringIssue["rollback"]>,
): Promise<RollbackConfirmation> {
  const previous = rollback.previous_deployment_id!;
  const requestedAt = Date.parse(rollback.requested_at ?? "");
  const polls = Number(rollback.polls ?? 0) + 1;
  if (!Number.isFinite(requestedAt)) {
    return { state: "failed", reason: "rollback request time is missing", polls };
  }
  const project = await vercel<{
    lastAliasRequest?: {
      type?: string;
      jobStatus?: string;
      requestedAt?: number;
      toDeploymentId?: string;
    } | null;
  }>("GET", `/v9/projects/${encodeURIComponent(target.projectId)}`, target);
  const job = project.lastAliasRequest;
  if (!job || !job.requestedAt || job.requestedAt < requestedAt - 1000) {
    return polls > 20
      ? { state: "failed", reason: "rollback confirmation timed out", polls }
      : { state: "pending", polls };
  }
  if (job.type !== "rollback" || job.toDeploymentId !== previous) {
    return {
      state: "failed",
      reason: "rollback was superseded by another production alias operation",
      polls,
    };
  }
  if (["failed", "skipped"].includes(String(job.jobStatus))) {
    return { state: "failed", reason: `Vercel rollback ${job.jobStatus}`, polls };
  }
  if (!["succeeded"].includes(String(job.jobStatus))) {
    return polls > 20
      ? { state: "failed", reason: "rollback confirmation timed out", polls }
      : { state: "pending", polls };
  }
  const aliases = await vercel<{
    aliases?: Array<{
      alias?: { alias?: string; deploymentId?: string };
      status?: string;
    }>;
    pagination?: { next?: number | null };
  }>(
    "GET",
    `/v9/projects/${encodeURIComponent(target.projectId)}/rollback/aliases?limit=100&since=${job.requestedAt}`,
    target,
  );
  if (!Array.isArray(aliases.aliases) || aliases.aliases.length === 0) {
    return { state: "failed", reason: "Vercel returned no production aliases to confirm", polls };
  }
  if (aliases.pagination?.next) {
    return { state: "failed", reason: "rollback alias confirmation was incomplete", polls };
  }
  const failed = aliases.aliases.find((alias) =>
    alias.alias?.deploymentId !== previous || alias.status === "failed" || alias.status === "skipped"
  );
  if (failed) {
    return {
      state: "failed",
      reason: "one or more production aliases did not map to the rollback deployment",
      polls,
    };
  }
  if (aliases.aliases.some((alias) => alias.status !== "completed")) {
    return polls > 20
      ? { state: "failed", reason: "rollback alias confirmation timed out", polls }
      : { state: "pending", polls };
  }
  return { state: "confirmed", polls, aliases: aliases.aliases.length };
}

/** Production verification from release-owned smoke and affected-flow policy. */
export async function verify(release: Caller, issueId: string): Promise<StepResult> {
  const issue = await loadIssue(release, issueId);
  if (issue.status !== "verifying") return { note: `status ${issue.status}` };
  const releasePolicy = await rpc("setting", { key: "release_policy" });
  const checks = verificationChecksForPolicy(releasePolicy, issue.repository!);
  if (!checks) {
    await update(release, issue, "escalated", {}, "Deployed, but no production verification is defined — a person must verify");
    return { note: "no checks" };
  }
  const target = await vercelTarget(issue.repository!);
  const previous = issue.rollback?.previous_deployment_id;
  if (target && previous && issue.rollback?.status === "requested") {
    try {
      const confirmation = await confirmVercelRollback(target, issue.rollback);
      if (confirmation.state === "pending") {
        await update(release, issue, null, {
          rollback: { ...issue.rollback, polls: confirmation.polls },
        });
        return {
          next: { step: "verify", delaySeconds: 30 },
          note: "rollback accepted; waiting for production aliases",
        };
      }
      if (confirmation.state === "failed") {
        await update(release, issue, "failed", {
          rollback: {
            ...issue.rollback,
            status: "confirmation_failed",
            polls: confirmation.polls,
          },
        }, `Vercel accepted rollback, but Bloom could not confirm restored traffic (${confirmation.reason}). Check production and complete rollback manually now.`);
        return { note: "rollback confirmation failed" };
      }
      const recoveryResults = await runProductionChecks(
        releasePolicy,
        issue.repository!,
        checks,
      );
      if (!recoveryResults.every((result) => result.pass)) {
        await update(release, issue, "failed", {
          rollback: {
            ...issue.rollback,
            status: "smoke_failed",
            polls: confirmation.polls,
            aliases_confirmed: confirmation.aliases,
            recovery_verification: {
              passed: false,
              scope: "release_smoke",
              checks: recoveryResults,
              at: new Date().toISOString(),
            },
          },
        }, "Vercel confirmed the rollback aliases, but the recovery smoke checks still failed. Production needs immediate human investigation.");
        return { note: "rollback recovery smoke failed" };
      }
      await update(release, issue, "rolled_back", {
        rollback: {
          ...issue.rollback,
          status: "confirmed",
          polls: confirmation.polls,
          aliases_confirmed: confirmation.aliases,
          rolled_back_at: new Date().toISOString(),
          recovery_verification: {
            passed: true,
            scope: "release_smoke",
            checks: recoveryResults,
            at: new Date().toISOString(),
          },
        },
      }, "Production verification failed; Vercel confirmed every production alias was restored to the previous deployment and Bloom's recovery smoke checks passed. The fix still needs a person.");
      return { note: "verification failed; rollback confirmed" };
    } catch (e) {
      await update(release, issue, "failed", {
        rollback: { ...issue.rollback, status: "confirmation_failed" },
      }, `Vercel accepted rollback, but confirmation failed (${e instanceof Error ? e.message : e}). Check production and complete rollback manually now.`);
      return { note: "rollback confirmation failed" };
    }
  }
  const verificationStartedAt = new Date().toISOString();
  const results = await runProductionChecks(releasePolicy, issue.repository!, checks);
  const smokePassed = results.every((r) => r.pass);
  const ticketFlow = smokePassed
    ? await runTicketFlowVerification(release, issue, releasePolicy)
    : { attempted: false, passed: true, ticketIds: [], checks: [], flows: [] };
  const passed = smokePassed && ticketFlow.passed;
  const verification = {
    passed,
    scope: ticketFlow.attempted ? "ticket_flow" : "release_smoke",
    ticket_ids: ticketFlow.ticketIds,
    checks: [
      ...results.map((result) => ({ ...result, check_scope: "release_smoke" })),
      ...ticketFlow.checks,
    ],
    release_smoke: { passed: smokePassed, checks: results },
    ticket_flows: ticketFlow.flows,
    started_at: verificationStartedAt,
    at: new Date().toISOString(),
  };
  if (passed) {
    await update(release, issue, "verified", {
      verification,
    });
    return { note: "verified" };
  }
  // Supported rollback: Vercel instant rollback to the deployment recorded before the merge.
  if (target && previous) {
    try {
      await vercel("POST", `/v1/projects/${target.projectId}/rollback/${previous}`, target);
      await update(release, issue, null, {
        verification,
        rollback: {
          ...issue.rollback,
          previous_deployment_id: previous,
          provider: "vercel",
          status: "requested",
          requested_at: new Date().toISOString(),
          polls: 0,
        },
      }, "Production verification failed. Vercel accepted the rollback request; Bloom is waiting to confirm every production alias before reporting recovery.");
      return {
        next: { step: "verify", delaySeconds: 30 },
        note: "verification failed; rollback requested",
      };
    } catch (e) {
      await update(release, issue, "failed", { verification }, `Verification failed and automatic rollback failed (${e instanceof Error ? e.message : e}). Roll back in Vercel now.`);
      return { note: "verification failed; rollback failed" };
    }
  }
  await update(release, issue, "failed", { verification },
    "Production verification failed after release. No automatic rollback is configured for this repository: roll back with Vercel instant rollback to the previous production deployment, then decide.");
  return { note: "verification failed" };
}
