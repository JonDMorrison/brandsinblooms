import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBinding, validatedFiles, serve } from './bloom-trusted-reproduction.mjs';
const valid = { BASE_SHA:'a'.repeat(40),HEAD_SHA:'b'.repeat(40),TRUSTED_SHA:'c'.repeat(40),REPOSITORY_ID:'123',RUN_ID:'1',RUN_ATTEMPT:'1',PR_NUMBER:'2',ISSUE_NUMBER:'3',ENGINEERING_ID:'12345678-1234-1234-1234-123456789abc',REPOSITORY:'JonDMorrison/brandsinblooms' };
test('binding rejects missing, malformed and unrelated identities',()=>{
  validateBinding(valid);
  for(const key of Object.keys(valid)) assert.throws(()=>validateBinding({...valid,[key]:''}));
  assert.throws(()=>validateBinding({...valid,HEAD_SHA:valid.BASE_SHA}));
  assert.throws(()=>validateBinding({...valid,REPOSITORY:'fork/repo'}));
});
test('static snapshot accepts regular bounded files only',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'bloom-static-test-'));
  try {
    assert.throws(()=>validatedFiles(root));
    writeFileSync(path.join(root,'index.html'),'<main>fixture</main>');
    assert.equal(validatedFiles(root).size,1);
    symlinkSync('index.html',path.join(root,'linked.html'));
    assert.throws(()=>validatedFiles(root),/Nonregular/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('static server serves exact route and denies writes without touching filesystem',async()=>{
  const server=await serve(new Map([['/index.html',Buffer.from('<main>fixture</main>')]]));
  try {
    const response=await fetch(`${server.origin}/support/contact`);
    assert.equal(response.status,200);assert.equal(await response.text(),'<main>fixture</main>');
    assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);
    assert.equal((await fetch(`${server.origin}/other`)).status,404);
    assert.equal((await fetch(`${server.origin}/support/contact`,{method:'POST'})).status,405);
  } finally {await server.close();}
});
test('workflow verifier remains read-only and executes only dispatched trusted scripts',async()=>{
  const { readFileSync }=await import('node:fs');
  const workflow=readFileSync(new URL('../workflows/bloom-repair.yml',import.meta.url),'utf8');
  const job=workflow.split('  trusted-reproduction:\n')[1].split('\n  report:')[0];
  assert.match(job,/ref: \$\{\{ github.sha \}\}/);
  assert.match(job,/persist-credentials: false/);
  assert.match(job,/npm ci --ignore-scripts/);
  assert.match(job,/contents: read/);
  assert.doesNotMatch(job,/secrets\.|contents: write|id-token: write/);
  assert.match(job,/run: node \.github\/scripts\/bloom-trusted-reproduction.mjs/);
  assert.match(job,/compression-level: 0/);
});
test('live request binding is exact, bounded and cannot supply a URL or executable',async()=>{
  const {liveBinding}=await import('./bloom-trusted-live.mjs');
  const context={issue_version:4,pr_number:12,head_sha:'a'.repeat(40),deployed_sha:'b'.repeat(40),deployment_id:'dpl_abc',ticket_binding:'c'.repeat(64)};
  const env={REPOSITORY:'JonDMorrison/brandsinblooms',REPOSITORY_ID:'1',RUN_ID:'2',RUN_ATTEMPT:'1',RUN_REF:'refs/heads/main',TRUSTED_SHA:'d'.repeat(40),ENGINEERING_ID:'12345678-1234-1234-1234-123456789abc',VERIFICATION_NONCE:'12345678-1234-1234-1234-123456789abd',VERIFICATION_CONTEXT:JSON.stringify(context)};
  assert.deepEqual(liveBinding(env),context);
  for(const patch of [{url:'https://example.com'},{issue_version:0},{pr_number:'12'},{head_sha:'main'},{head_sha:['a'.repeat(40)]},{ticket_binding:'x'},{deployment_id:'../bad'}]) {
    assert.throws(()=>liveBinding({...env,VERIFICATION_CONTEXT:JSON.stringify({...context,...patch})}));
  }
  for(const patch of [{RUN_REF:'refs/heads/other'},{VERIFICATION_NONCE:'bad'},{VERIFICATION_CONTEXT:'['},{VERIFICATION_CONTEXT:' '.repeat(2049)}])assert.throws(()=>liveBinding({...env,...patch}));
});
test('live job has no repair execution, candidate checkout, Docker, or secret credentials',async()=>{
  const {readFileSync}=await import('node:fs');
  const workflow=readFileSync(new URL('../workflows/bloom-repair.yml',import.meta.url),'utf8');
  const job=workflow.split('  trusted-live-verification:\n')[1].split('\n  report:')[0];
  assert.match(job,/inputs.mode == 'verify'/);assert.match(job,/ref: "\$\{\{ github.sha \}\}"/);
  assert.doesNotMatch(job,/secrets\.|docker|inputs.head|inputs.deployed|contents: write/);
  assert.match(job,/VERIFICATION_CONTEXT: \$\{\{ inputs.verification_context \}\}/);
  assert.match(workflow,/if: always\(\) && inputs.mode != 'verify'/);
  const supervisor=readFileSync(new URL('./bloom-trusted-reproduction.mjs',import.meta.url),'utf8');
  assert.match(supervisor,/chromiumSandbox: true/);
  assert.match(supervisor,/image, 'node', '-e', BUILD/);
  assert.match(workflow,/PINNED_BASE: \$\{\{ needs.prepare.outputs.base_sha \}\}/);
});

test('reviewed observer source pins match the complete current writer catalogue',async()=>{
  const {readFileSync}=await import('node:fs');
  const {createHash}=await import('node:crypto');
  const {TRUSTED_SOURCES}=await import('../../supabase/functions/_shared/bloom-support/trusted-observer-core.ts');
  assert.equal(Object.keys(TRUSTED_SOURCES).length,6);
  for(const [file,expected] of Object.entries(TRUSTED_SOURCES)){
    assert.match(expected,/^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+file,import.meta.url))).digest('hex'),expected,file);
  }
});
