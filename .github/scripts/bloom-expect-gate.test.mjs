import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBinding, assertCurrentScope, waitForProof, githubReader, REPOSITORY, HELPER, FIXTURE } from './bloom-expect-gate.mjs';
const head = 'b'.repeat(40), base = 'a'.repeat(40), uuid = '12345678-1234-1234-1234-123456789abc';
function event() {
  return { repository: { id: 1, full_name: REPOSITORY }, number: 9, pull_request: {
    number: 9, state: 'open', changed_files: 2,
    body: `Automated fix proposed by Bloom for #7.\n\nBloom-Engineering-Issue: \`${uuid}\``,
    head: { sha: head, ref: 'bloom/fix-12345678', repo: { id: 1 } },
    base: { sha: base, ref: 'main', repo: { id: 1 } },
  } };
}
const files = () => [{ filename: HELPER, status: 'modified' }, { filename: FIXTURE, status: 'added' }];
function harness(e = event()) {
  let now = 0;
  const state = { pr: e.pull_request, files: files(), main: { ref: 'refs/heads/main', object: { type: 'commit', sha: base } }, runs: [], sleeps: 0, proofs: 0 };
  const io = { now: () => now, sleep: async ms => { now += ms; state.sleeps++; }, api: async path => {
    if (path.endsWith('/git/ref/heads/main')) return state.main;
    if (path.endsWith('/files?per_page=100')) return state.files;
    if (path.includes('/actions/workflows/')) return { workflow_runs: state.runs };
    return state.pr;
  } };
  return { state, io };
}
const run = () => ({ id: 99, run_attempt: 1, display_title: `Bloom repair ${uuid}`, head_sha: base, status: 'completed', conclusion: 'success' });
const proof = () => ({ runId: 99, attempt: 1, artifactId: 4, base, head, recipe: 'public-support-attachment-name-v1' });

test('exact same-repository generated identity only', () => {
  assert.equal(eventBinding(event()).engineeringIssueId, uuid);
  for (const mutate of [e => e.pull_request.head.repo.id = 2, e => e.pull_request.base.ref = 'other', e => e.pull_request.head.ref += '-extra', e => e.pull_request.body += `\nBloom-Engineering-Issue: \`${uuid}\``, e => e.pull_request.body = 'ordinary PR', e => e.pull_request.head.sha = 'oops']) {
    const e = event(); mutate(e); assert.throws(() => eventBinding(e));
  }
});
test('only helper modification plus exact newly added regression file', async () => {
  const { state, io } = harness(); await assertCurrentScope(eventBinding(event()), io.api);
  for (const bad of [[], [files()[0]], [...files(), { filename: '.github/workflows/expect.yml', status: 'modified' }], [{ ...files()[0], status: 'renamed', previous_filename: 'x' }, files()[1]], [files()[0], { ...files()[1], status: 'modified' }], [files()[0], { filename: 'src/pages/Other.tsx', status: 'added' }]]) {
    state.files = bad; await assert.rejects(assertCurrentScope(eventBinding(event()), io.api));
  }
});
test('missing receipt and claimed run success never grant proof', async () => {
  const { state, io } = harness(); state.runs = [run()];
  await assert.rejects(waitForProof(event(), io, { proofReader: async () => null, timeoutMs: 30, intervalMs: 10 }), /no valid browser proof/);
  assert.equal(state.sleeps, 0);
});
test('waits for independently verified proof, then rechecks PR', async () => {
  const { state, io } = harness(); state.runs = [run()];
  state.runs[0].status = 'in_progress';
  const sleep = io.sleep;
  io.sleep = async ms => { await sleep(ms); state.runs[0].status = 'completed'; };
  const result = await waitForProof(event(), io, { proofReader: async (binding, id) => { assert.equal(id, 99); assert.equal(binding.head, head); return proof(); }, timeoutMs: 50, intervalMs: 10 });
  assert.equal(result.artifactId, 4); assert.equal(state.sleeps, 1);
});
test('head/base drift and identity changes fail after proof', async () => {
  for (const mutate of [s => s.pr.head.sha = 'c'.repeat(40), s => s.pr.base.sha = 'c'.repeat(40), s => s.pr.body += '\nAutomated fix proposed by Bloom for #8.', s => s.pr.state = 'closed']) {
    const e = event(), { state, io } = harness(structuredClone(e)); state.runs = [run()];
    await assert.rejects(waitForProof(e, io, { proofReader: async () => { mutate(state); return proof(); } }));
  }
});
test('incorrect locator and wrong recipe/base/head cannot produce success', async () => {
  for (const change of [{ head_sha: 'c'.repeat(40) }, { display_title: 'other' }, { status: 'in_progress' }, { conclusion: 'failure' }]) {
    const { state, io } = harness(); state.runs = [{ ...run(), ...change }];
    await assert.rejects(waitForProof(event(), io, { proofReader: async () => { throw Error('must not call'); }, timeoutMs: 10, intervalMs: 10 }));
  }
  for (const change of [{ head: base }, { base: head }, { recipe: 'other' }]) {
    const { state, io } = harness(); state.runs = [run()];
    await assert.rejects(waitForProof(event(), io, { proofReader: async () => ({ ...proof(), ...change }) }), /binding mismatch/);
  }
});
test('production core is fail-closed, never a boolean stub', async () => {
  const { state, io } = harness(); state.runs = [run()];
  await assert.rejects(waitForProof(event(), io, { timeoutMs: 10, intervalMs: 10 }), /no valid browser proof/);
});
test('API reads never follow redirects or send token to storage', async () => {
  const calls = [];
  const reader = githubReader('synthetic-token', { fetcher: async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: 'https://safe.blob.core.windows.net/receipt?sig=synthetic' } });
    return new Response(new Uint8Array([1, 2, 3]));
  } });
  assert.deepEqual(await reader.artifact(REPOSITORY, 12), new Uint8Array([1, 2, 3]));
  assert.equal(calls[0].options.redirect, 'manual'); assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(calls[1].options.redirect, 'error'); assert.equal(calls[1].options.headers, undefined);
  await assert.rejects(reader.api('/repos/elsewhere/private')); assert.equal(calls.length, 2);
});
test('rejects storage forgery, API redirects, excessive artifact and malformed JSON', async () => {
  for (const location of ['http://safe.blob.core.windows.net/file', 'https://evil.example/file', 'https://u:p@safe.blob.core.windows.net/file', 'https://safe.blob.core.windows.net.evil.example/file']) {
    let count = 0;
    const reader = githubReader('synthetic', { fetcher: async () => { count++; return new Response(null, { status: 302, headers: { location } }); } });
    await assert.rejects(reader.artifact(REPOSITORY, 12)); assert.equal(count, 1);
  }
  const redirect = githubReader('synthetic', { fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }) });
  await assert.rejects(redirect.api(`/repos/${REPOSITORY}/pulls/9`), /GitHub read failed/);
  let count = 0;
  const large = githubReader('synthetic', { fetcher: async () => ++count === 1 ? new Response(null, { status: 302, headers: { location: 'https://safe.blob.core.windows.net/a' } }) : new Response(new Uint8Array(32769)) });
  await assert.rejects(large.artifact(REPOSITORY, 12), /exceeds limit/);
});

test('never falls back from newer failed, invalid or unfinished run to older valid proof', async () => {
  for (const change of [{ conclusion: 'failure' }, { status: 'in_progress', conclusion: null }, { head_sha: 'c'.repeat(40) }, {}]) {
    const { state, io } = harness(); state.runs = [{ ...run(), id: 100, ...change }, run()];
    const requested = [];
    await assert.rejects(waitForProof(event(), io, { proofReader: async (_binding, id) => { requested.push(id); return id === 99 ? proof() : null; }, timeoutMs: 20, intervalMs: 10 }));
    assert.equal(requested.includes(99), false);
  }
});
test('new dispatch or rerun while verifying invalidates proof', async () => {
  for (const mutate of [s => s.runs.unshift({ ...run(), id: 100, status: 'queued' }), s => s.runs[0].run_attempt++]) {
    const { state, io } = harness(); state.runs = [run()];
    await assert.rejects(waitForProof(event(), io, { proofReader: async () => { mutate(state); return proof(); } }), /changed during proof/);
  }
});


test('authoritative main rejects stale PR base snapshots before and after proof', async () => {
  for (const main of [null, {}, {ref:'refs/heads/main',object:{type:'commit',sha:'d'.repeat(40)}}, {ref:'refs/heads/main',object:{type:'tag',sha:base}}, {ref:'refs/heads/other',object:{type:'commit',sha:base}}]) {
    const {state,io}=harness(); state.runs=[run()]; state.main=main;
    let read=false;
    await assert.rejects(waitForProof(event(),io,{proofReader:async()=>{read=true;return proof();}}));
    assert.equal(read,false,'stale main is refused before proof reading');
  }
  const {state,io}=harness(); state.runs=[run()];
  await assert.rejects(waitForProof(event(),io,{proofReader:async()=>{
    state.main.object.sha='d'.repeat(40);return proof();
  }}), /main/);
  assert.equal(state.pr.base.sha,base,'PR base snapshot did not move');
});
