// Minimal GitHub REST client. Two credentials, never mixed:
//  - BLOOM_GITHUB_REPAIR_TOKEN: issues + workflow dispatch + read (the untrusted
//    repair side). It cannot merge: give it a fine-grained token with
//    Issues: write, Actions: write, Contents: read, Pull requests: read.
//  - BLOOM_GITHUB_RELEASE_TOKEN: reads PR facts and merges eligible PRs.
//    Contents: write, Pull requests: write. Never passed to the repair workflow.
import { BloomError, env } from "./runtime.ts";
import type { PullRequestFacts } from "./policy.ts";

export type Credential = "repair" | "release";

function token(cred: Credential): string {
  const name = cred === "repair" ? "BLOOM_GITHUB_REPAIR_TOKEN" : "BLOOM_GITHUB_RELEASE_TOKEN";
  const t = env(name);
  if (!t) throw new BloomError(503, "not_configured", `${name} is not set`);
  return t;
}

export async function gh<T = unknown>(cred: Credential, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token(cred)}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bloom-support",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 204) return undefined as T;
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new BloomError(res.status === 404 ? 404 : res.status === 403 || res.status === 401 ? 403 : 502, "github_error", `GitHub ${method} ${path}: ${res.status} ${(out as { message?: string }).message ?? ""}`);
  return out as T;
}

export async function ghGraphql<T>(cred: Credential, query: string, variables: Record<string, unknown>): Promise<T> {
  const out = await gh<{ data?: T; errors?: unknown }>(cred, "POST", "/graphql", { query, variables });
  if (!out.data) throw new BloomError(502, "github_error", `GraphQL: ${JSON.stringify(out.errors).slice(0, 300)}`);
  return out.data;
}

export interface PullRequest {
  number: number;
  html_url: string;
  state: string;
  merged: boolean;
  mergeable: boolean | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  merge_commit_sha: string | null;
}

export async function findPullRequestForBranch(cred: Credential, repo: string, branch: string): Promise<PullRequest | null> {
  const owner = repo.split("/")[0];
  const list = await gh<PullRequest[]>(cred, "GET", `/repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=5`);
  return list[0] ?? null;
}

export async function pullRequestFacts(repo: string, number: number, repairLogins: string[]): Promise<{ pr: PullRequest; facts: PullRequestFacts }> {
  const pr = await gh<PullRequest>("release", "GET", `/repos/${repo}/pulls/${number}`);
  const files = await gh<Array<{ filename: string; additions: number; deletions: number; status: string }>>("release", "GET", `/repos/${repo}/pulls/${number}/files?per_page=100`);
  const runs = await gh<{ check_runs: Array<{ name: string; status: string; conclusion: string | null }> }>("release", "GET", `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);
  const statuses = await gh<{ statuses: Array<{ context: string; state: string }> }>("release", "GET", `/repos/${repo}/commits/${pr.head.sha}/status`);
  const reviews = await gh<Array<{ state: string; user: { login: string }; commit_id: string }>>("release", "GET", `/repos/${repo}/pulls/${number}/reviews?per_page=100`);
  const [owner, name] = repo.split("/");
  const threads = await ghGraphql<{ repository: { pullRequest: { reviewThreads: { nodes: Array<{ isResolved: boolean }> } } } }>("release",
    `query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100){nodes{isResolved}}}}}`, { o: owner, n: name, p: number });
  const isTest = (p: string) => /(^|\/)(__tests__|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
  // Latest review per reviewer, on the current head only.
  const latest = new Map<string, { state: string; login: string }>();
  for (const r of reviews.filter((r) => r.commit_id === pr.head.sha)) latest.set(r.user.login, { state: r.state, login: r.user.login });
  return {
    pr,
    facts: {
      repository: repo,
      files: files.map((f) => ({ path: f.filename, additions: f.additions, deletions: f.deletions, status: f.status })),
      checks: [
        ...runs.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
        ...statuses.statuses.map((s) => ({ name: s.context, status: s.state === "pending" ? "in_progress" : "completed", conclusion: s.state === "success" ? "success" : s.state === "pending" ? null : "failure" })),
      ],
      reviews: [...latest.values()].map((r) => ({ state: r.state, author: r.login, independent: r.login !== pr.user.login && !repairLogins.includes(r.login) })),
      unresolvedThreads: threads.repository.pullRequest.reviewThreads.nodes.filter((t) => !t.isResolved).length,
      mergeable: pr.mergeable,
      baseBranch: pr.base.ref,
      testFilesAdded: files.filter((f) => isTest(f.filename) && f.status === "added").map((f) => f.filename),
      testFilesModifiedOrDeleted: files.filter((f) => isTest(f.filename) && f.status !== "added").map((f) => f.filename),
    },
  };
}

/** Merge pinned to the evaluated head SHA: a push after evaluation makes the merge fail. */
export async function mergePullRequest(repo: string, number: number, sha: string, title: string): Promise<{ sha: string }> {
  const out = await gh<{ sha: string; merged: boolean }>("release", "PUT", `/repos/${repo}/pulls/${number}/merge`, { sha, merge_method: "squash", commit_title: title });
  if (!out.merged) throw new BloomError(409, "conflict", "GitHub did not merge the pull request");
  return { sha: out.sha };
}

export interface DeploymentState {
  state: "pending" | "success" | "failure" | "unknown";
  environment: string | null;
  url: string | null;
  deployment_id: number | null;
}

/** Production deployment for a commit, from GitHub Deployments (Vercel reports there). */
export async function productionDeployment(repo: string, sha: string): Promise<DeploymentState> {
  const deps = await gh<Array<{ id: number; environment: string; production_environment?: boolean }>>("release", "GET", `/repos/${repo}/deployments?sha=${sha}&per_page=20`);
  const prod = deps.find((d) => d.production_environment || /^production$/i.test(d.environment));
  if (!prod) return { state: "pending", environment: null, url: null, deployment_id: null };
  const statuses = await gh<Array<{ state: string; environment_url?: string; target_url?: string }>>("release", "GET", `/repos/${repo}/deployments/${prod.id}/statuses?per_page=5`);
  const s = statuses[0];
  const state = !s ? "pending" : s.state === "success" ? "success" : ["failure", "error", "inactive"].includes(s.state) ? "failure" : "pending";
  return { state, environment: prod.environment, url: s?.environment_url ?? s?.target_url ?? null, deployment_id: prod.id };
}
