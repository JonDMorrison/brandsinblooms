/** Independent hosted proof. No agent report, test path or claimed boolean is authority. */

export const RECIPE = "public-support-attachment-name-v1";
export const WORKFLOW = ".github/workflows/bloom-repair.yml";
export const ARTIFACT = "bloom-trusted-reproduction-v1";
export const JOB = "trusted-reproduction";
const REPO = "JonDMorrison/brandsinblooms";
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// Reviewed source pins bind the complete isolated writer and dependency catalogue.
// Unknown revisions deliberately disable the capability, not its release gates.
export const TRUSTED_SOURCES: Readonly<Record<string, string>> = Object.freeze({
  [WORKFLOW]: "6987909915fd43fd10b2f8db1ac57247d01c6efc10b0bfb3412c6a19e6a56ef7",
  ".github/scripts/bloom-trusted-live.mjs": "5881fbc17d67aac4d9369cfbf4293aafe213b881ca346c3731b5994319d52d25",
  "package.json": "e58b04dc74b91eb5efc1c7488edf416a73dd36b15654b00b475da9b1747a56f1",
  "package-lock.json": "018bcb1f9eb26ef7882231aa845b613ab31a08275be7c8ff6f4d684b810e2493",
  ".github/scripts/bloom-trusted-reproduction.mjs": "99af39ee90b2ba975e92cbb012e5c6f529da72aa6fe7b2d82af9840b41e186cf",
  ".github/scripts/bloom-public-attachment-recipe.mjs": "7bc01ecdd2c2ac4e961ffe64b565f92901399d5d8000f907a3bf59c33585371e",
});
type ObjectValue = Record<string, unknown>;
const obj = (v: unknown): ObjectValue => v && typeof v === "object" && !Array.isArray(v) ? v as ObjectValue : {};
const id = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
export async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))), b => b.toString(16).padStart(2, "0")).join("");
}

/** One bounded ZIP entry only. No filesystem extraction, paths or dependencies. */
async function readResponseBytes(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Missing decoded body");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > limit) throw Error("Decoded receipt too large");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function receiptFromZip(bytes: Uint8Array): Promise<unknown> {
  if (bytes.length < 22 || bytes.length > 32768) throw Error("archive size");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number) => view.getUint16(p, true), u32 = (p: number) => view.getUint32(p, true);
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== 1 || u16(end + 10) !== 1 || u16(end + 20)) throw Error("archive directory");
  const central = u32(end + 16);
  if (central < 30 || central + 46 > end || central + u32(end + 12) !== end || u32(central) !== 0x02014b50) throw Error("archive offset");
  const flags = u16(central + 8), method = u16(central + 10);
  const packed = u32(central + 20), unpacked = u32(central + 24), nameLen = u16(central + 28);
  if ((flags & ~0x808) || ![0, 8].includes(method) || unpacked > 16384 || packed > 32768 || u16(central + 34) || u32(central + 42) !== 0 ||
      central + 46 + nameLen + u16(central + 30) + u16(central + 32) !== end) throw Error("archive entry");
  const decode = (a: number, b: number) => new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(a, b));
  if (decode(central + 46, central + 46 + nameLen) !== "receipt.json" || u32(0) !== 0x04034b50 || u16(6) !== flags || u16(8) !== method || u16(26) !== nameLen || decode(30, 30 + nameLen) !== "receipt.json") throw Error("archive filename");
  const start = 30 + nameLen + u16(28), dataEnd = start + packed;
  const descriptor = (flags & 8) ? central - dataEnd : 0;
  if (dataEnd > central || (!(flags & 8) && dataEnd !== central) || ((flags & 8) && descriptor !== 12 && descriptor !== 16)) throw Error("archive data");
  if (!(flags & 8) && (u32(18) !== packed || u32(22) !== unpacked || u32(14) !== u32(central + 16))) throw Error("archive sizes");
  if (flags & 8) {
    const d = dataEnd + (descriptor === 16 ? 4 : 0);
    if ((descriptor === 16 && u32(dataEnd) !== 0x08074b50) || u32(d) !== u32(central + 16) || u32(d + 4) !== packed || u32(d + 8) !== unpacked) throw Error("archive descriptor");
  }
  let raw = bytes.slice(start, dataEnd);
  if (method === 8) raw = await readResponseBytes(new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))), 16384);
  if (raw.length !== unpacked) throw Error("archive decoded size");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
}

export interface ProofBinding { repository: string; engineeringIssueId: string; githubIssue: number; pr: number; head: string; }
export interface TrustedProof { runId: number; attempt: number; artifactId: number; artifactDigest: string; base: string; head: string; tree: string; recipe: string; }
export function validObservation(value: unknown, outcome: "reproduced" | "green"): boolean {
  const v = obj(value), a = obj(v.assertions), s = obj(v.safety);
  return v.recipe === RECIPE && v.outcome === outcome && a.controlAccepted === true && a.controlRemoved === true && a.formUnsubmitted === true &&
    a.overlongAccepted === (outcome === "reproduced") && a.overlongRejected === (outcome === "green") && a.filenameLimitWarning === (outcome === "green") &&
    ["nonGetAttempts", "webSocketAttempts", "serviceWorkerAttempts", "redirectsBlocked", "networkFailures"].every(k => s[k] === 0) &&
    typeof s.externalGetBlocked === "number" && Number.isSafeInteger(s.externalGetBlocked) && s.externalGetBlocked >= 0;
}
export function validReceipt(value: unknown, binding: ProofBinding, run: ObjectValue, repoId: number, tree: string, pins: Readonly<Record<string, string>>, now: number): boolean {
  const r = obj(value), observations = obj(r.observations);
  const created = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
  const started = Date.parse(String(run.run_started_at)), finished = Date.parse(String(run.updated_at));
  return r.schema === 1 && r.recipe === RECIPE && r.repository === binding.repository && r.repository_id === String(repoId) &&
    r.engineering_issue_id === binding.engineeringIssueId && r.github_issue === binding.githubIssue && r.pr_number === binding.pr &&
    r.workflow_path === WORKFLOW && r.run_id === String(run.id) && r.run_attempt === String(run.run_attempt) &&
    r.base_sha === run.head_sha && r.trusted_sha === run.head_sha && r.head_sha === binding.head && r.head_tree === tree &&
    r.dependency_lock_digest === pins["package-lock.json"] && r.package_manifest_digest === pins["package.json"] &&
    r.workflow_digest === pins[WORKFLOW] && r.supervisor_digest === pins[".github/scripts/bloom-trusted-reproduction.mjs"] && r.recipe_digest === pins[".github/scripts/bloom-public-attachment-recipe.mjs"] &&
    Number.isFinite(created) && created >= started && created <= finished && created <= now + 60000 && now - created <= 24 * 3600_000 &&
    validObservation(observations.base, "reproduced") && validObservation(observations.head, "green");
}

type Api = <T = unknown>(path: string) => Promise<T>;
export interface ProofReader { api: Api; artifact: (repository: string, artifactId: number) => Promise<Uint8Array>; now: () => number; }

/** Shared immutable run/job/source/artifact provenance for both observer modes. */
export async function readTrustedEnvelope(repository: string, runId: number, title: string, job: string, artifact: string, io: ProofReader, pins = TRUSTED_SOURCES) {
  try {
    if (repository !== REPO || !id(runId) || Object.values(pins).length !== 6 || Object.values(pins).some(v => !DIGEST.test(v))) return null;
    const root = `/repos/${repository}`;
    const repo = await io.api<ObjectValue>(root);
    if (!id(repo.id) || repo.full_name !== repository || repo.default_branch !== "main") return null;
    const run = await io.api<ObjectValue>(`${root}/actions/runs/${runId}`);
    if (run.id !== runId || !id(run.run_attempt) || run.event !== "workflow_dispatch" || run.path !== WORKFLOW || run.head_branch !== "main" || !SHA.test(String(run.head_sha)) || run.status !== "completed" || run.conclusion !== "success" || obj(run.repository).id !== repo.id || obj(run.head_repository).id !== repo.id || run.display_title !== title) return null;
    const workflow = await io.api<ObjectValue>(`${root}/actions/workflows/${encodeURIComponent("bloom-repair.yml")}`);
    if (run.workflow_id !== workflow.id || workflow.path !== WORKFLOW || !id(workflow.id)) return null;
    const jobs = await io.api<{ total_count: number; jobs: ObjectValue[] }>(`${root}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100`);
    if (!Array.isArray(jobs.jobs) || jobs.jobs.length !== jobs.total_count || jobs.jobs.length >= 100) return null;
    const selected = jobs.jobs.filter(j => j.name === job);
    if (selected.length !== 1 || selected[0].run_id !== runId || selected[0].run_attempt !== run.run_attempt || selected[0].head_sha !== run.head_sha || selected[0].status !== "completed" || selected[0].conclusion !== "success") return null;
    for (const [path, digest] of Object.entries(pins)) {
      const source = await io.api<ObjectValue>(`${root}/contents/${path}?ref=${run.head_sha}`);
      if (source.type !== "file" || source.encoding !== "base64" || typeof source.content !== "string" || source.content.length > 3000000 || typeof source.size !== "number" || source.size > 2000000) return null;
      const bytes = Uint8Array.from(atob(source.content.replace(/\s/g, "")), c => c.charCodeAt(0));
      if (bytes.length !== source.size || await sha256(bytes) !== digest) return null;
    }
    const list = await io.api<{ total_count: number; artifacts: ObjectValue[] }>(`${root}/actions/runs/${runId}/artifacts?per_page=100`);
    if (!Array.isArray(list.artifacts) || list.artifacts.length !== list.total_count || list.artifacts.length >= 100) return null;
    const artifacts = list.artifacts.filter(a => a.name === artifact);
    if (artifacts.length !== 1) return null;
    const a = artifacts[0], digest = String(a.digest ?? "");
    if (!id(a.id) || a.expired !== false || typeof a.size_in_bytes !== "number" || a.size_in_bytes < 22 || a.size_in_bytes > 32768 || !/^sha256:[a-f0-9]{64}$/.test(digest) || obj(a.workflow_run).id !== runId || obj(a.workflow_run).head_sha !== run.head_sha) return null;
    const bytes = await io.artifact(repository, a.id as number);
    if (bytes.length !== a.size_in_bytes || await sha256(bytes) !== digest.slice(7)) return null;
    const receipt = await receiptFromZip(bytes);
    // Reruns invalidate the earlier attempt even when the head is unchanged.
    const fresh = await io.api<ObjectValue>(`${root}/actions/runs/${runId}`);
    if (fresh.run_attempt !== run.run_attempt || fresh.status !== "completed" || fresh.conclusion !== "success" || fresh.head_sha !== run.head_sha) return null;
    return { receipt: obj(receipt), run, repoId: repo.id as number, runId, attempt: run.run_attempt as number, artifactId: a.id as number, artifactDigest: digest };
  } catch { return null; }
}

/** The envelope alone is never a reproduction claim; bind the exact current PR. */
export async function readTrustedProof(binding: ProofBinding, runId: number, io: ProofReader, pins = TRUSTED_SOURCES): Promise<TrustedProof | null> {
  try {
    if (binding.repository !== REPO || !UUID.test(binding.engineeringIssueId) || !id(binding.githubIssue) || !id(binding.pr) || !SHA.test(binding.head)) return null;
    const root = `/repos/${binding.repository}`;
    const pr = await io.api<ObjectValue>(`${root}/pulls/${binding.pr}`);
    const open = pr.state === "open" && pr.merged === false;
    const historical = pr.state === "closed" && pr.merged === true;
    if (!open && !historical) return null;
    // PR base.sha may be a stale synchronization snapshot, not current main.
    // Only explicitly merged PRs may use a historical baseline after main moves.
    const mainMatches = async (baseline: unknown) => {
      const main = await io.api<ObjectValue>(`${root}/git/ref/heads/main`);
      return SHA.test(String(baseline)) && obj(main).ref === "refs/heads/main" &&
        obj(obj(main).object).type === "commit" && obj(obj(main).object).sha === baseline;
    };
    if (open && !await mainMatches(obj(pr.base).sha)) return null;
    const envelope = await readTrustedEnvelope(binding.repository, runId, `Bloom repair ${binding.engineeringIssueId}`, JOB, ARTIFACT, io, pins);
    if (!envelope) return null;
    const { run, receipt, repoId } = envelope;
    const matchesPR = (value: ObjectValue) => value.state === pr.state && value.merged === pr.merged &&
      obj(value.head).sha === binding.head && obj(obj(value.head).repo).id === repoId &&
      obj(obj(value.base).repo).id === repoId && obj(value.base).ref === "main" && obj(value.base).sha === run.head_sha;
    if (!matchesPR(pr)) return null;
    const commit = await io.api<ObjectValue>(`${root}/git/commits/${binding.head}`);
    const tree = obj(commit.tree).sha;
    if (commit.sha !== binding.head || !SHA.test(String(tree)) || !Array.isArray(commit.parents) || commit.parents.length !== 1 || obj(commit.parents[0]).sha !== run.head_sha) return null;
    if (!validReceipt(receipt, binding, run, repoId, tree as string, pins, io.now())) return null;
    const freshPR = await io.api<ObjectValue>(`${root}/pulls/${binding.pr}`);
    if (!matchesPR(freshPR) || (open && !await mainMatches(run.head_sha))) return null;
    // Bounded freshness checks, not an atomic merge precondition.
    return { runId, attempt: envelope.attempt, artifactId: envelope.artifactId, artifactDigest: envelope.artifactDigest, base: run.head_sha as string, head: binding.head, tree: tree as string, recipe: RECIPE };
  } catch { return null; }
}

