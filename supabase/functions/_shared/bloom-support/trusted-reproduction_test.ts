import { assertEquals, assertRejects } from "@std/assert";
import { assignedReproduction, ARTIFACT, JOB, RECIPE, WORKFLOW, readTrustedProof, receiptFromZip, sha256, validObservation, validReceipt, type ProofReader } from "./trusted-reproduction.ts";
const head = "b".repeat(40), base = "a".repeat(40), tree = "c".repeat(40);
const binding = { repository: "JonDMorrison/brandsinblooms", engineeringIssueId: "00000000-0000-0000-0000-000000000001", githubIssue: 5, pr: 8, head };
const now = Date.parse("2026-11-12T12:00:00Z");
const sources = { ".github/scripts/bloom-trusted-live.mjs": "live", "package.json": "manifest", "package-lock.json": "lock", [WORKFLOW]: "workflow", ".github/scripts/bloom-trusted-reproduction.mjs": "supervisor", ".github/scripts/bloom-public-attachment-recipe.mjs": "recipe" };
const pins: Record<string, string> = {};
for (const [path, source] of Object.entries(sources)) pins[path] = await sha256(new TextEncoder().encode(source));
const run = { id: 10, run_attempt: 1, workflow_id: 20, event: "workflow_dispatch", path: WORKFLOW, head_branch: "main", head_sha: base, repository: { id: 30 }, head_repository: { id: 30 }, status: "completed", conclusion: "success", display_title: `Bloom repair ${binding.engineeringIssueId}`, run_started_at: "2026-11-12T11:30:00Z", updated_at: "2026-11-12T11:50:00Z" };
function observation(outcome: string) { return { recipe: RECIPE, outcome, assertions: { controlAccepted: true, controlRemoved: true, overlongAccepted: outcome === "reproduced", overlongRejected: outcome === "green", filenameLimitWarning: outcome === "green", formUnsubmitted: true }, safety: { nonGetAttempts: 0, externalGetBlocked: 4, webSocketAttempts: 0, serviceWorkerAttempts: 0, redirectsBlocked: 0, networkFailures: 0 } }; }
const receipt = { schema: 1, recipe: RECIPE, repository: binding.repository, repository_id: "30", engineering_issue_id: binding.engineeringIssueId, github_issue: 5, pr_number: 8, workflow_path: WORKFLOW, run_id: "10", run_attempt: "1", base_sha: base, trusted_sha: base, head_sha: head, head_tree: tree, dependency_lock_digest: pins["package-lock.json"], package_manifest_digest: pins["package.json"], workflow_digest: pins[WORKFLOW], supervisor_digest: pins[".github/scripts/bloom-trusted-reproduction.mjs"], recipe_digest: pins[".github/scripts/bloom-public-attachment-recipe.mjs"], created_at: "2026-11-12T11:45:00Z", observations: { base: observation("reproduced"), head: observation("green") } };
function zip(value: unknown, name = "receipt.json") {
  const raw = new TextEncoder().encode(JSON.stringify(value)), filename = new TextEncoder().encode(name);
  const central = 30 + filename.length + raw.length, end = central + 46 + filename.length;
  const bytes = new Uint8Array(end + 22), d = new DataView(bytes.buffer);
  const w16 = (p: number, n: number) => d.setUint16(p, n, true), w32 = (p: number, n: number) => d.setUint32(p, n, true);
  w32(0, 0x04034b50); w32(18, raw.length); w32(22, raw.length); w16(26, filename.length); bytes.set(filename, 30); bytes.set(raw, 30 + filename.length);
  w32(central, 0x02014b50); w32(central + 20, raw.length); w32(central + 24, raw.length); w16(central + 28, filename.length); bytes.set(filename, central + 46);
  w32(end, 0x06054b50); w16(end + 8, 1); w16(end + 10, 1); w32(end + 12, 46 + filename.length); w32(end + 16, central);
  return bytes;
}
async function fixture(mutate?: (path: string, value: unknown) => unknown, value: unknown = receipt): Promise<ProofReader> {
  const bytes = zip(value), digest = `sha256:${await sha256(bytes)}`;
  return { now: () => now, artifact: () => Promise.resolve(bytes), api: <T>(path: string): Promise<T> => Promise.resolve().then(() => {
    let result: unknown;
    if (path.endsWith(`/repos/${binding.repository}`)) result = { id: 30, full_name: binding.repository, default_branch: "main" };
    else if (path.endsWith("/actions/runs/10")) result = structuredClone(run);
    else if (path.includes("/actions/workflows/")) result = { id: 20, path: WORKFLOW };
    else if (path.includes("/attempts/1/jobs")) result = { total_count: 1, jobs: [{ name: JOB, run_id: 10, run_attempt: 1, head_sha: base, status: "completed", conclusion: "success" }] };
    else if (path.includes("/contents/")) { const key = path.split("/contents/")[1].split("?")[0]; const s = sources[key as keyof typeof sources]; result = { type: "file", encoding: "base64", content: btoa(s), size: s.length }; }
    else if (path.endsWith("/pulls/8")) result = { state: "open", merged: false, head: { sha: head, repo: { id: 30 } }, base: { ref: "main", sha: base, repo: { id: 30 } } };
    else if (path.endsWith("/git/ref/heads/main")) result = { ref: "refs/heads/main", object: { type: "commit", sha: base } };
    else if (path.includes("/git/commits/")) result = { sha: head, tree: { sha: tree }, parents: [{ sha: base }] };
    else if (path.includes("/artifacts?")) result = { total_count: 1, artifacts: [{ id: 40, name: ARTIFACT, expired: false, size_in_bytes: bytes.length, digest, workflow_run: { id: 10, head_sha: base } }] };
    else throw Error(`Unexpected ${path}`);
    return (mutate ? mutate(path, result) : result) as T;
  }) };
}
Deno.test("receipt accepts only exact known baseline assertion failure and head success", () => {
  assertEquals(validReceipt(receipt, binding, run, 30, tree, pins, now), true);
  for (const field of ["head_sha", "base_sha", "head_tree", "trusted_sha", "repository_id", "run_attempt", "workflow_digest", "recipe_digest", "supervisor_digest", "engineering_issue_id"]) assertEquals(validReceipt({ ...receipt, [field]: "wrong" }, binding, run, 30, tree, pins, now), false, field);
  assertEquals(validReceipt({ ...receipt, created_at: "2026-11-11T10:00:00Z" }, binding, run, 30, tree, pins, now), false);
  assertEquals(validReceipt(receipt, binding, run, 30, tree, pins, now + 25 * 3600_000), false);
  for (const outcome of ["setup_failure", "green", "failure"]) assertEquals(validObservation(observation(outcome), "reproduced"), false);
  for (const field of ["nonGetAttempts", "webSocketAttempts", "serviceWorkerAttempts", "redirectsBlocked", "networkFailures"]) { const v = observation("green"); Object.assign(v.safety, { [field]: 1 }); assertEquals(validObservation(v, "green"), false); }
});
Deno.test("bounded ZIP reader rejects extra entries, traversal, encryption and oversized receipts", async () => {
  assertEquals(await receiptFromZip(zip(receipt)), receipt);
  await assertRejects(() => receiptFromZip(zip(receipt, "../receipt.json")));
  const two = zip(receipt); new DataView(two.buffer).setUint16(two.length - 12, 2, true); await assertRejects(() => receiptFromZip(two));
  const encrypted = zip(receipt); const central = new DataView(encrypted.buffer).getUint32(encrypted.length - 6, true); new DataView(encrypted.buffer).setUint16(central + 8, 1, true); await assertRejects(() => receiptFromZip(encrypted));
  await assertRejects(() => receiptFromZip(zip("x".repeat(17000))));
  await assertRejects(() => receiptFromZip(new Uint8Array(32769)));
});
Deno.test("proof independently reads source, immutable artifact, current PR and exact successful attempt", async () => {
  const proof = await readTrustedProof(binding, 10, await fixture(), pins);
  assertEquals(proof?.head, head); assertEquals(proof?.tree, tree);
  assertEquals(await readTrustedProof(binding, 10, await fixture()), null, "unpinned writer disabled");
  const mutations: Array<(path: string, value: unknown) => unknown> = [
    (p, v) => p.endsWith("/actions/runs/10") ? { ...v as object, event: "pull_request" } : v,
    (p, v) => p.endsWith("/actions/runs/10") ? { ...v as object, head_repository: { id: 99 } } : v,
    (p, v) => p.endsWith("/actions/runs/10") ? { ...v as object, run_attempt: 2 } : v,
    (p, v) => p.includes("/jobs?") ? { total_count: 1, jobs: [{ name: JOB, run_id: 10, run_attempt: 1, head_sha: base, status: "completed", conclusion: "skipped" }] } : v,
    (p, v) => p.includes("/contents/") ? { ...v as object, content: btoa("forged") } : v,
    (p, v) => p.includes("/pulls/") ? { state: "open", merged: false, head: { sha: "d".repeat(40), repo: { id: 30 } }, base: { ref: "main", sha: base, repo: { id: 30 } } } : v,
    // An old successful run cannot authorize the same head against a moved main base.
    (p, v) => p.includes("/pulls/") ? { state: "open", merged: false, head: { sha: head, repo: { id: 30 } }, base: { ref: "main", sha: "d".repeat(40), repo: { id: 30 } } } : v,
    (p, v) => p.includes("/pulls/") ? { state: "open", merged: false, head: { sha: head, repo: { id: 30 } }, base: { ref: "main", repo: { id: 30 } } } : v,
    (p, v) => p.includes("/git/commits/") ? { ...v as object, parents: [{ sha: "d".repeat(40) }] } : v,
    (p, v) => p.includes("/artifacts?") ? { total_count: 2, artifacts: [] } : v,
    (p, v) => p.includes("/artifacts?") ? { total_count: 1, artifacts: [{ ...(v as { artifacts: object[] }).artifacts[0], digest: `sha256:${"0".repeat(64)}` }] } : v,
  ];
  for (const mutation of mutations) assertEquals(await readTrustedProof(binding, 10, await fixture(mutation), pins), null);
  assertEquals(await readTrustedProof(binding, 10, await fixture(undefined, { ...receipt, observations: { ...receipt.observations, base: observation("setup_failure") } }), pins), null);
  let reads = 0;
  assertEquals(await readTrustedProof(binding, 10, await fixture((p, v) => p.endsWith("/actions/runs/10") && ++reads > 1 ? { ...v as object, run_attempt: 2 } : v), pins), null);
});

Deno.test("trusted recipe assignment cannot be borrowed by an unrelated issue or ticket set", () => {
  const ticket = "00000000-0000-0000-0000-000000000002";
  const issue = { id: binding.engineeringIssueId, evidence: { github_issue: { number: 5 } }, tickets: [{ id: ticket }] };
  const policy = { trustedReproductionIssues: { [issue.id]: { recipe: RECIPE, github_issue: 5, ticket_ids: [ticket] } } };
  assertEquals(assignedReproduction(policy, issue), true);
  assertEquals(assignedReproduction({}, issue), false);
  assertEquals(assignedReproduction(policy, { ...issue, id: ticket }), false);
  assertEquals(assignedReproduction(policy, { ...issue, tickets: [] }), false);
  assertEquals(assignedReproduction(policy, { ...issue, tickets: [{ id: issue.id }] }), false);
  assertEquals(assignedReproduction(policy, { ...issue, evidence: { github_issue: { number: 6 } } }), false);
});

Deno.test("artifact reader sends credentials only to GitHub and bounds storage redirects", async () => {
  const { ghArtifactBytes } = await import("./github.ts");
  const fetchOriginal = globalThis.fetch;
  const oldToken = Deno.env.get("BLOOM_GITHUB_REPAIR_TOKEN");
  Deno.env.set("BLOOM_GITHUB_REPAIR_TOKEN", "test-only-not-a-real-credential");
  try {
    const bytes = zip(receipt); let calls = 0;
    globalThis.fetch = (input, init) => Promise.resolve().then(() => {
      calls++;
      if (calls === 1) {
        assertEquals(String(input), `https://api.github.com/repos/${binding.repository}/actions/artifacts/40/zip`);
        assertEquals(init?.redirect, "manual");
        assertEquals(new Headers(init?.headers).get("authorization"), "Bearer test-only-not-a-real-credential");
        return new Response(null, { status: 302, headers: { location: "https://results.blob.core.windows.net/artifact?sig=test" } });
      }
      assertEquals(init?.headers, undefined); assertEquals(init?.redirect, "error");
      return new Response(bytes);
    });
    assertEquals(await ghArtifactBytes(binding.repository, 40), bytes); assertEquals(calls, 2);
    for (const location of ["http://results.blob.core.windows.net/archive", "https://evil.test/archive", "https://results.blob.core.windows.net.evil.test/archive", "https://user@results.blob.core.windows.net/archive"]) {
      globalThis.fetch = () => Promise.resolve(new Response(null, { status: 302, headers: { location } }));
      await assertRejects(() => ghArtifactBytes(binding.repository, 40));
    }
    let oversizedCalls = 0;
    globalThis.fetch = () => Promise.resolve(++oversizedCalls === 1 ? new Response(null, { status: 302, headers: { location: "https://results.blob.core.windows.net/archive" } }) : new Response(new Uint8Array(32769)));
    await assertRejects(() => ghArtifactBytes(binding.repository, 40));
  } finally {
    globalThis.fetch = fetchOriginal;
    if (oldToken === undefined) Deno.env.delete("BLOOM_GITHUB_REPAIR_TOKEN"); else Deno.env.set("BLOOM_GITHUB_REPAIR_TOKEN", oldToken);
  }
});

Deno.test("ZIP reader handles bounded native raw deflate and rejects a decompression bomb", async () => {
  async function compressed(value: unknown) {
    const raw = new TextEncoder().encode(JSON.stringify(value));
    const packed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const stored = zip(value), oldCentral = 42 + raw.length;
    const bytes = new Uint8Array(stored.length - raw.length + packed.length);
    bytes.set(stored.subarray(0, 42)); bytes.set(packed, 42); bytes.set(stored.subarray(oldCentral), 42 + packed.length);
    const d = new DataView(bytes.buffer), central = 42 + packed.length;
    d.setUint16(8, 8, true); d.setUint32(18, packed.length, true);
    d.setUint16(central + 10, 8, true); d.setUint32(central + 20, packed.length, true);
    d.setUint32(bytes.length - 6, central, true);
    return bytes;
  }
  assertEquals(await receiptFromZip(await compressed(receipt)), receipt);
  const bomb = await compressed("x".repeat(100000));
  const d = new DataView(bomb.buffer), central = d.getUint32(bomb.length - 6, true);
  // A dishonest advertised size must not bypass the streamed output limit.
  d.setUint32(22, 10, true); d.setUint32(central + 24, 10, true);
  await assertRejects(() => receiptFromZip(bomb));
});


Deno.test("open proof requires authoritative main before and after verification despite stale PR base", async () => {
  for (const main of [null, {}, {ref:"refs/heads/main",object:{type:"commit",sha:"d".repeat(40)}}, {ref:"refs/heads/main",object:{type:"tag",sha:base}}, {ref:"refs/heads/other",object:{type:"commit",sha:base}}]) {
    assertEquals(await readTrustedProof(binding,10,await fixture((p,v)=>p.endsWith("/git/ref/heads/main")?main:v),pins),null);
  }
  let mainReads=0;
  assertEquals(await readTrustedProof(binding,10,await fixture((p,v)=>p.endsWith("/git/ref/heads/main") && ++mainReads>1
    ? {ref:"refs/heads/main",object:{type:"commit",sha:"d".repeat(40)}}:v),pins),null);
  assertEquals(mainReads,2,"actual main is re-read after proof validation");
  for (const patch of [{head:{sha:"d".repeat(40),repo:{id:30}}},{state:"closed",merged:false},{state:"closed",merged:true}]) {
    let prReads=0;
    assertEquals(await readTrustedProof(binding,10,await fixture((p,v)=>p.endsWith("/pulls/8") && ++prReads>1?{...v as object,...patch}:v),pins),null);
  }
});

Deno.test("only explicit merged PRs preserve historical proof without requiring current main", async () => {
  let mainReads=0;
  const merged=await fixture((p,v)=>{
    if(p.endsWith("/git/ref/heads/main")){mainReads++;return {ref:"refs/heads/main",object:{type:"commit",sha:"d".repeat(40)}};}
    return p.endsWith("/pulls/8")?{...v as object,state:"closed",merged:true}:v;
  });
  assertEquals((await readTrustedProof(binding,10,merged,pins))?.head,head);
  assertEquals(mainReads,0,"historical merged receipts are not compared with later main");
  for(const patch of [{state:"closed",merged:false},{state:undefined,merged:undefined},{state:"open",merged:true},{state:"closed",merged:"true"}]) {
    assertEquals(await readTrustedProof(binding,10,await fixture((p,v)=>p.endsWith("/pulls/8")?{...v as object,...patch}:v),pins),null);
  }
});
