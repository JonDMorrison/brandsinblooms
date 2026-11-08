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
