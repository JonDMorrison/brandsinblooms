// Pure, fail-closed selection of actionable GitHub checks for Slack releases.
// PR branch checks remain visible in GitHub without flooding the staff release room.
export interface FailedMainCheckSuite { id: number; sha: string; }

export function failedMainCheckSuite(value: unknown): FailedMainCheckSuite | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const suite = value as Record<string, unknown>;
  if (suite.head_branch !== "main" || suite.conclusion !== "failure") return null;
  if (typeof suite.id !== "number" || !Number.isSafeInteger(suite.id) || suite.id <= 0) return null;
  if (typeof suite.head_sha !== "string" || !/^[0-9a-f]{40}$/i.test(suite.head_sha)) return null;
  return { id: suite.id, sha: suite.head_sha.toLowerCase() };
}

/** Shared by webhook hints and authoritative deployment reads. */
export function isProductionEnvironment(deployment: { environment: string; production_environment?: boolean }): boolean {
  const name = deployment.environment.trim();
  if (/(?:^|[\s–—-])(preview|demo|staging|development|test)(?:[\s–—-]|$)/i.test(name)) return false;
  return deployment.production_environment === true || /^production(?:\s|$|[-–—])/i.test(name);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export interface EngineeringEventHint { sha: string; pr: number | null; deployment: boolean; }

/** Only identifiers travel to the queue. Event conclusions never grant release authority. */
export function engineeringEventHints(event: string, payload: Record<string, unknown>): EngineeringEventHint[] {
  const repository = object(payload.repository).full_name;
  const hint = (sha: unknown, pr: unknown, deployment = false): EngineeringEventHint[] =>
    typeof sha === "string" && /^[0-9a-f]{40}$/i.test(sha) &&
      (deployment || (typeof pr === "number" && Number.isSafeInteger(pr) && pr > 0))
      ? [{ sha: sha.toLowerCase(), pr: deployment ? null : pr as number, deployment }] : [];
  if (event === "deployment_status") {
    const d = object(payload.deployment);
    if (!["success", "failure", "error"].includes(String(object(payload.deployment_status).state)) ||
        typeof d.environment !== "string" || !isProductionEnvironment({ environment: d.environment, production_environment: d.production_environment === true })) return [];
    return hint(d.sha, null, true);
  }
  if (event === "pull_request" || event === "pull_request_review") {
    const pr = object(payload.pull_request);
    if (object(object(pr.base).repo).full_name !== repository || object(object(pr.head).repo).full_name !== repository) return [];
    return hint(object(pr.head).sha, pr.number);
  }
  if (!["workflow_run", "check_suite", "check_run"].includes(event) || payload.action !== "completed") return [];
  const run = object(payload[event]);
  if (!Array.isArray(run.pull_requests)) return [];
  // GitHub may send a synthetic merge SHA for checks. Never guess the head.
  return run.pull_requests.slice(0, 20).flatMap((entry) => {
    const pr = object(entry);
    if (object(pr.head).sha !== run.head_sha) return [];
    return hint(run.head_sha, pr.number);
  });
}
