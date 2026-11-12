/** Live browser observations use the same frozen observer and artifact reader.
 * Provider identity is checked by Edge before dispatch and after observation;
 * GitHub never receives provider credentials or a caller-selected URL. */
import { gh } from "./github.ts";
import { readTrustedEnvelope, RECIPE, TRUSTED_SOURCES, validObservation, WORKFLOW } from "./trusted-reproduction.ts";
export const LIVE_ORIGIN = "https://bloomsuite.app";
export const LIVE_PATH = "/support/contact";
export const LIVE_JOB = "trusted-live-verification";
export const LIVE_ARTIFACT = "bloom-trusted-live-v1";
const REPO = "JonDMorrison/brandsinblooms";
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export interface LiveRequest {
  nonce: string; engineering_issue_id: string; issue_version: number; head_sha: string; deployed_sha: string;
  deployment_id: string; project_id: string; team_id: string | null; ticket_binding: string; pr_number: number; created_at: string;
}
export function validLiveRequest(value: unknown): value is LiveRequest {
  const r = obj(value);
  return typeof r.nonce === "string" && UUID.test(r.nonce) && typeof r.engineering_issue_id === "string" && UUID.test(r.engineering_issue_id) &&
    typeof r.issue_version === "number" && Number.isSafeInteger(r.issue_version) && r.issue_version > 0 &&
    typeof r.head_sha === "string" && SHA.test(r.head_sha) && typeof r.deployed_sha === "string" && SHA.test(r.deployed_sha) && typeof r.deployment_id === "string" && /^dpl_[A-Za-z0-9]{1,100}$/.test(r.deployment_id) &&
    typeof r.project_id === "string" && /^prj_[A-Za-z0-9]{1,100}$/.test(r.project_id) && (r.team_id === null || typeof r.team_id === "string" && /^team_[A-Za-z0-9]{1,100}$/.test(r.team_id)) &&
    typeof r.ticket_binding === "string" && /^[a-f0-9]{64}$/.test(r.ticket_binding) && typeof r.pr_number === "number" && Number.isSafeInteger(r.pr_number) && r.pr_number > 0 &&
    typeof r.created_at === "string" && Number.isFinite(Date.parse(r.created_at));
}
export function liveReceiptMatches(value: unknown, request: LiveRequest, run: Record<string, unknown>, repoId: number, now = Date.now(), pins = TRUSTED_SOURCES): boolean {
  const r = obj(value), started = Date.parse(String(r.started_at)), finished = Date.parse(String(r.created_at));
  return r.schema === 1 && r.mode === "live" && r.recipe === RECIPE && r.repository === REPO && r.repository_id === String(repoId) &&
    r.workflow_path === WORKFLOW && r.trusted_sha === run.head_sha && r.run_id === String(run.id) && r.run_attempt === String(run.run_attempt) &&
    r.engineering_issue_id === request.engineering_issue_id && r.nonce === request.nonce && r.issue_version === request.issue_version &&
    r.head_sha === request.head_sha && r.deployed_sha === request.deployed_sha && r.deployment_id === request.deployment_id &&
    r.ticket_binding === request.ticket_binding && r.pr_number === request.pr_number && r.origin === LIVE_ORIGIN && r.path === LIVE_PATH &&
    r.workflow_digest === pins[WORKFLOW] && r.supervisor_digest === pins[".github/scripts/bloom-trusted-live.mjs"] &&
    r.recipe_digest === pins[".github/scripts/bloom-public-attachment-recipe.mjs"] && r.dependency_lock_digest === pins["package-lock.json"] && r.package_manifest_digest === pins["package.json"] &&
    Number.isFinite(started) && Number.isFinite(finished) && started >= Date.parse(request.created_at) &&
    started >= Date.parse(String(run.run_started_at)) && finished >= started && finished <= Date.parse(String(run.updated_at)) &&
    finished <= now + 60000 && now - Date.parse(request.created_at) <= 30 * 60000 &&
    obj(r.observation).observed_origin === LIVE_ORIGIN && obj(r.observation).observed_path === LIVE_PATH && validObservation(r.observation, "green");
}
export async function observeLiveRequest(request: LiveRequest): Promise<{ state: "pending" | "blocked" } | { state: "proved"; evidence: Record<string, unknown> }> {
  if (!validLiveRequest(request) || Date.now() - Date.parse(request.created_at) > 30 * 60000) return { state: "blocked" };
  try {
    const title = `Bloom verify ${request.engineering_issue_id} ${request.nonce}`;
    const list = await gh<{ workflow_runs?: Array<Record<string, unknown>> }>("repair", "GET", `/repos/${REPO}/actions/workflows/bloom-repair.yml/runs?event=workflow_dispatch&per_page=100`);
    if (!Array.isArray(list.workflow_runs)) return { state: "blocked" };
    const runs = list.workflow_runs.filter(r => r.display_title === title);
    if (runs.length === 0) return { state: "pending" };
    // A duplicate dispatch or rerun is not silently accepted as the sole request.
    if (runs.length !== 1 || runs[0].run_attempt !== 1 || typeof runs[0].id !== "number") return { state: "blocked" };
    if (runs[0].status !== "completed") return { state: "pending" };
    const envelope = await readTrustedEnvelope(REPO, runs[0].id, title, LIVE_JOB, LIVE_ARTIFACT);
    if (!envelope || !liveReceiptMatches(envelope.receipt, request, envelope.run, envelope.repoId)) return { state: "blocked" };
    return { state: "proved", evidence: { recipe: RECIPE, run_id: envelope.runId, run_attempt: envelope.attempt, artifact_id: envelope.artifactId, artifact_digest: envelope.artifactDigest, nonce: request.nonce, deployment_id: request.deployment_id, deployed_sha: request.deployed_sha, head_sha: request.head_sha, ticket_binding: request.ticket_binding, origin: LIVE_ORIGIN, path: LIVE_PATH, started_at: envelope.receipt.started_at, finished_at: envelope.receipt.created_at } };
  } catch { return { state: "pending" }; }
}
export async function dispatchLiveRequest(request: LiveRequest): Promise<void> {
  if (!validLiveRequest(request)) throw Error("Invalid live request");
  await gh("repair", "POST", `/repos/${REPO}/actions/workflows/bloom-repair.yml/dispatches`, {
    ref: "main", inputs: { mode: "verify", engineering_issue_id: request.engineering_issue_id, verification_nonce: request.nonce,
      verification_context: JSON.stringify({ issue_version: request.issue_version, head_sha: request.head_sha, deployed_sha: request.deployed_sha, deployment_id: request.deployment_id, ticket_binding: request.ticket_binding, pr_number: request.pr_number }) },
  });
}
