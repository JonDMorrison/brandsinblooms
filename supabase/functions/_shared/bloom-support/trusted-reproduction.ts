// Edge integration; the shared verifier itself is runtime/credential-free.
import { gh, ghArtifactBytes } from "./github.ts";
import { ARTIFACT, RECIPE, TRUSTED_SOURCES, WORKFLOW, readTrustedEnvelope as coreEnvelope, readTrustedProof as coreProof, receiptFromZip, type ProofBinding, type ProofReader, type TrustedProof } from "./trusted-observer-core.ts";
export * from "./trusted-observer-core.ts";
const reader: ProofReader = { api: path => gh("repair", "GET", path), artifact: ghArtifactBytes, now: Date.now };
const REPO = "JonDMorrison/brandsinblooms";
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type ObjectValue = Record<string, unknown>;
const obj = (v: unknown): ObjectValue => v && typeof v === "object" && !Array.isArray(v) ? v as ObjectValue : {};
const id = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
export const readTrustedProof = (binding: ProofBinding, runId: number, io: ProofReader = reader, pins = TRUSTED_SOURCES) => coreProof(binding, runId, io, pins);
export const readTrustedEnvelope = (repository: string, runId: number, title: string, job: string, artifact: string, io: ProofReader = reader, pins = TRUSTED_SOURCES) => coreEnvelope(repository, runId, title, job, artifact, io, pins);

/** Bounded discovery is only a locator. Every candidate is independently proved. */
export async function trustedReproduction(binding: ProofBinding): Promise<TrustedProof | null> {
  if (binding.repository !== REPO || !UUID.test(binding.engineeringIssueId) || Object.values(TRUSTED_SOURCES).some(v => !DIGEST.test(v))) return null;
  try {
    const list = await reader.api<{ workflow_runs?: ObjectValue[] }>(`/repos/${REPO}/actions/workflows/bloom-repair.yml/runs?event=workflow_dispatch&per_page=20`);
    const runs = list.workflow_runs?.filter(r => r.display_title === `Bloom repair ${binding.engineeringIssueId}`) ?? [];
    // Never fall back to an old successful attempt after a newer run failed.
    if (!runs.length || !id(runs[0].id)) return null;
    return await readTrustedProof(binding, runs[0].id as number);
  } catch { return null; }
}

/** Recipe assignment is release-owned exact scope, never ticket prose or an agent report. */
export function assignedReproduction(policy: unknown, issue: { id: string; evidence: Record<string, unknown>; tickets: Array<{ id: string }> }): boolean {
  const assigned = obj(obj(obj(policy).trustedReproductionIssues)[issue.id]);
  const tickets = issue.tickets.map(t => t.id).sort();
  const expected = assigned.ticket_ids;
  return UUID.test(issue.id) && assigned.recipe === RECIPE && id(assigned.github_issue) &&
    assigned.github_issue === obj(issue.evidence.github_issue).number &&
    tickets.length > 0 && new Set(tickets).size === tickets.length && tickets.every(t => UUID.test(t)) &&
    Array.isArray(expected) && expected.length === tickets.length && expected.every(t => typeof t === "string") &&
    [...expected].sort().every((t, i) => t === tickets[i]);
}

/** Called only after webhook signature/repository validation. A run is a hint,
 * never an eligibility grant. The queue's existing PR/head matching and the
 * evaluator's exact issue assignment still apply. */
export async function trustedRunEventHint(repository: string, runId: unknown): Promise<{ sha: string; pr: number } | null> {
  if (repository !== REPO || !id(runId) || Object.values(TRUSTED_SOURCES).some(v => !DIGEST.test(v))) return null;
  try {
    const root = `/repos/${REPO}`;
    const run = await reader.api<ObjectValue>(`${root}/actions/runs/${runId}`);
    const liveTitle = typeof run.display_title === "string" ? run.display_title.match(/^Bloom verify ([a-f0-9-]{36}) ([a-f0-9-]{36})$/) : null;
    if (liveTitle && UUID.test(liveTitle[1]) && UUID.test(liveTitle[2])) {
      const envelope = await readTrustedEnvelope(REPO, runId as number, liveTitle[0], "trusted-live-verification", "bloom-trusted-live-v1");
      const receipt = envelope?.receipt;
      // A proven writer may wake the matching issue, but only verify() can
      // compare its persisted nonce and before/after provider identity.
      return receipt?.mode === "live" && receipt.engineering_issue_id === liveTitle[1] && receipt.nonce === liveTitle[2] &&
        id(receipt.pr_number) && SHA.test(String(receipt.head_sha))
        ? { sha: receipt.head_sha as string, pr: receipt.pr_number as number } : null;
    }
    const issueId = typeof run.display_title === "string" ? run.display_title.replace(/^Bloom repair /, "") : "";
    if (!UUID.test(issueId) || run.path !== WORKFLOW || run.event !== "workflow_dispatch" || run.status !== "completed" || run.conclusion !== "success") return null;
    const list = await reader.api<{ total_count: number; artifacts: ObjectValue[] }>(`${root}/actions/runs/${runId}/artifacts?per_page=100`);
    if (!Array.isArray(list.artifacts) || list.total_count !== list.artifacts.length || list.artifacts.length >= 100) return null;
    const artifacts = list.artifacts.filter(a => a.name === ARTIFACT);
    if (artifacts.length !== 1 || !id(artifacts[0].id)) return null;
    // This first read yields untrusted identifiers only; readTrustedProof re-reads
    // the complete authenticated provenance and compares the immutable digest.
    const locator = obj(await receiptFromZip(await reader.artifact(REPO, artifacts[0].id as number)));
    if (!id(locator.github_issue) || !id(locator.pr_number) || !SHA.test(String(locator.head_sha))) return null;
    const proof = await readTrustedProof({ repository: REPO, engineeringIssueId: issueId, githubIssue: locator.github_issue as number, pr: locator.pr_number as number, head: locator.head_sha as string }, runId as number);
    return proof ? { sha: proof.head, pr: locator.pr_number as number } : null;
  } catch { return null; }
}
