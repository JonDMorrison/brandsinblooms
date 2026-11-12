/** Read-only gate for the single catalogued Bloom browser reproduction.
 * Executed only from the PR's frozen base. Never checks out or executes its head.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readTrustedProof, RECIPE } from '../../supabase/functions/_shared/bloom-support/trusted-observer-core.ts';

export const REPOSITORY = 'JonDMorrison/brandsinblooms';
export const HELPER = 'src/lib/bloomSupport/constants.ts';
export const FIXTURE = 'src/lib/bloomSupport/constants.test.ts';
const SHA = /^[a-f0-9]{40}$/;
const positive = n => Number.isSafeInteger(n) && n > 0;
const fail = message => { throw Error(message); };

export function eventBinding(event) {
  const pr = event.pull_request;
  if (!pr || event.repository?.full_name !== REPOSITORY || !positive(event.repository?.id) ||
      pr.head?.repo?.id !== event.repository.id || pr.base?.repo?.id !== event.repository.id ||
      pr.base?.ref !== 'main' || !SHA.test(pr.base?.sha ?? '') || !SHA.test(pr.head?.sha ?? '') ||
      !positive(pr.number) || event.number !== pr.number || pr.state !== 'open') fail('Unsupported PR binding');
  const markers = [...(pr.body ?? '').matchAll(/^Bloom-Engineering-Issue: `([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})`\r?$/gm)];
  const issues = [...(pr.body ?? '').matchAll(/^Automated fix proposed by Bloom for #([1-9][0-9]{0,9})\.\r?$/gm)];
  if (markers.length !== 1 || issues.length !== 1 || pr.head.ref !== `bloom/fix-${markers[0][1].slice(0, 8)}`) fail('Missing unique repair identity');
  return { repository: REPOSITORY, engineeringIssueId: markers[0][1], githubIssue: Number(issues[0][1]), pr: pr.number, head: pr.head.sha, base: pr.base.sha, repoId: event.repository.id, branch: pr.head.ref };
}

export async function assertCurrentScope(binding, api) {
  const root = `/repos/${REPOSITORY}/pulls/${binding.pr}`;
  const pr = await api(root);
  if (pr.number !== binding.pr || pr.state !== 'open' || pr.head?.sha !== binding.head || pr.base?.sha !== binding.base ||
      pr.head?.ref !== binding.branch || pr.base?.ref !== 'main' || pr.head?.repo?.id !== binding.repoId || pr.base?.repo?.id !== binding.repoId) fail('PR changed or repository binding differs');
  const rebound = eventBinding({ repository: { full_name: REPOSITORY, id: binding.repoId }, number: binding.pr, pull_request: pr });
  if (rebound.engineeringIssueId !== binding.engineeringIssueId || rebound.githubIssue !== binding.githubIssue) fail('Repair identity changed');
  const files = await api(`${root}/files?per_page=100`);
  if (!Array.isArray(files) || files.length !== 2 || pr.changed_files !== 2 ||
      files.filter(f => f.filename === HELPER && f.status === 'modified' && !f.previous_filename).length !== 1 ||
      files.filter(f => f.filename === FIXTURE && f.status === 'added' && !f.previous_filename).length !== 1) fail('Outside catalogued helper and new regression fixture scope');
}

export async function waitForProof(event, io, { proofReader = readTrustedProof, timeoutMs = 900000, intervalMs = 15000 } = {}) {
  if (!(timeoutMs > 0 && timeoutMs <= 900000) || !(intervalMs > 0)) fail('Invalid wait bound');
  const binding = eventBinding(event), deadline = io.now() + timeoutMs;
  do {
    await assertCurrentScope(binding, io.api);
    const runPath = `/repos/${REPOSITORY}/actions/workflows/bloom-repair.yml/runs?event=workflow_dispatch&per_page=100`;
    const newest = async () => {
      const runs = await io.api(runPath);
      if (!Array.isArray(runs.workflow_runs) || runs.workflow_runs.length > 100) fail('Malformed workflow run list');
      // GitHub lists newest first. Never fall back to an older successful run,
      // even when the newest dispatch failed, is queued, or targets another base.
      return runs.workflow_runs.find(r => r.display_title === `Bloom repair ${binding.engineeringIssueId}`);
    };
    const run = await newest();
    if (run) {
      if (!positive(run.id) || run.head_sha !== binding.base) fail('Newest repair run has invalid identity or base');
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') fail('Newest repair run did not succeed');
        const proof = await proofReader(binding, run.id, io);
        if (!proof) fail('Newest completed repair run has no valid browser proof');
        if (proof.head !== binding.head || proof.base !== binding.base || proof.recipe !== RECIPE) fail('Proof binding mismatch');
        await assertCurrentScope(binding, io.api);
        const fresh = await newest();
        if (!fresh || fresh.id !== run.id || fresh.run_attempt !== proof.attempt || fresh.status !== 'completed' || fresh.conclusion !== 'success' || fresh.head_sha !== binding.base) fail('Newest repair run changed during proof verification');
        if (io.now() >= deadline) fail('Browser proof deadline exceeded');
        return proof;
      }
    }
    if (io.now() >= deadline) break;
    await io.sleep(Math.min(intervalMs, deadline - io.now()));
  } while (io.now() < deadline);
  fail('No verified frozen red-to-green browser receipt before deadline');
}

async function bytes(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) fail('Missing response body');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length; if (length > limit) fail('Response exceeds limit'); chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return new Uint8Array(Buffer.concat(chunks, length));
}

export function githubReader(token, { fetcher = fetch, signal = AbortSignal.timeout(900000) } = {}) {
  if (!token) fail('Read-only GitHub token missing');
  const request = (path) => {
    if (!(path === `/repos/${REPOSITORY}` || path.startsWith(`/repos/${REPOSITORY}/`)) || /[\\#]/.test(path) || path.includes('..')) fail('Unexpected API path');
    return fetcher(`https://api.github.com${path}`, { method: 'GET', redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  };
  return {
    now: Date.now,
    sleep: ms => new Promise((resolve, reject) => {
      if (signal.aborted) return reject(Error('Proof deadline exceeded'));
      const onAbort = () => { clearTimeout(timer); reject(Error('Proof deadline exceeded')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    }),
    api: async path => {
      const response = await request(path);
      if (response.status !== 200) { await response.body?.cancel(); fail(`GitHub read failed (${response.status})`); }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await bytes(response, 4000000)));
    },
    artifact: async (repository, id) => {
      if (repository !== REPOSITORY || !positive(id)) fail('Invalid artifact identity');
      const response = await request(`/repos/${REPOSITORY}/actions/artifacts/${id}/zip`);
      const location = response.headers.get('location'); await response.body?.cancel();
      if (response.status !== 302) fail('Artifact redirect missing');
      const url = new URL(location ?? '');
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !(/\.blob\.core\.windows\.net$/.test(url.hostname) || /\.actions\.githubusercontent\.com$/.test(url.hostname))) fail('Untrusted artifact storage');
      const archive = await fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
      if (archive.status !== 200) { await archive.body?.cancel(); fail('Artifact download failed'); }
      return bytes(archive, 32768);
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const proof = await waitForProof(event, githubReader(process.env.GH_TOKEN));
    console.log(`Verified ${RECIPE}: run ${proof.runId}, attempt ${proof.attempt}, head ${proof.head}, artifact ${proof.artifactId}.`);
  } catch (error) {
    console.error(`Bloom browser proof gate failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}
