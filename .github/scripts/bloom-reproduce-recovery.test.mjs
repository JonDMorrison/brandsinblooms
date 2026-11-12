import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bindRecovery, validateRecoveryInputs, validateRecoveryPR, validateRecoveryTree } from './bloom-trusted-reproduction.mjs';
const e = {MODE:'reproduce', RUN_REF:'refs/heads/main', BASE_BRANCH:'main', BRANCH:'bloom/fix-12345678', TRUSTED_SHA:'a'.repeat(40), EXPECTED_HEAD:'b'.repeat(40), EXPECTED_PR:'496', REPOSITORY:'JonDMorrison/brandsinblooms', REPOSITORY_ID:'123', RUN_ID:'1', RUN_ATTEMPT:'1', ISSUE_NUMBER:'494', ENGINEERING_ID:'12345678-1234-1234-1234-123456789abc'};
const repo = {full_name:e.REPOSITORY,id:123};
const pr = {number:496,state:'open',merged:false,head:{sha:e.EXPECTED_HEAD,ref:e.BRANCH,repo},base:{sha:e.TRUSTED_SHA,ref:'main',repo},body:`Automated fix proposed by Bloom for #494.\n\nBloom-Engineering-Issue: \`${e.ENGINEERING_ID}\``};
const diff = 'A\0src/lib/bloomSupport/constants.test.ts\0M\0src/lib/bloomSupport/constants.ts\0';
function git(...args) {
  if (args[0] === 'rev-parse') return args[1] === 'HEAD' ? e.TRUSTED_SHA : 'c'.repeat(40);
  if (args[0] === 'rev-list') return `${e.EXPECTED_HEAD} ${e.TRUSTED_SHA}`;
  if (args[0] === 'diff') return diff;
  if (args[0] === 'ls-tree') return `100644 blob ${'d'.repeat(40)}\t${args.at(-1)}`;
  if (args[0] === 'show') return `fix: Bloom repair for #494\n\nBloom-Engineering-Issue: ${e.ENGINEERING_ID}\n`;
  throw Error('Unexpected command');
}
test('recovery input rejects non-main/non-reproduction dispatch, wrong branch and malformed identities',()=>{
  validateRecoveryInputs(e);
  for (const patch of [{MODE:'repair'},{MODE:'verify'},{RUN_REF:'refs/pull/496/merge'},{BASE_BRANCH:'dev'},{BRANCH:'bloom/fix-deadbeef'},{REPOSITORY:'fork/repo'},{EXPECTED_HEAD:e.TRUSTED_SHA},{EXPECTED_HEAD:'main'},{EXPECTED_PR:'496\nwrite=true'},{ENGINEERING_ID:'invalid'}]) assert.throws(()=>validateRecoveryInputs({...e,...patch}));
});
test('PR recovery binds exact open same-repository head/current main and unique issue markers',()=>{
  validateRecoveryPR(e,pr,e.TRUSTED_SHA);
  assert.throws(()=>validateRecoveryPR(e,pr,'c'.repeat(40)));
  for(const patch of [{number:497},{state:'closed'},{merged:true},{head:{...pr.head,sha:'c'.repeat(40)}},{head:{...pr.head,ref:'other'}},{head:{...pr.head,repo:{...repo,id:124}}},{head:{...pr.head,repo:{...repo,full_name:'fork/repo'}}},{base:{...pr.base,ref:'dev'}},{base:{...pr.base,sha:'c'.repeat(40)}},{base:{...pr.base,repo:{...repo,id:124}}},{body:pr.body+'\nBloom-Engineering-Issue: other'},{body:pr.body+'\nAutomated fix proposed by Bloom for #495.'},{body:pr.body.replace('#494','#495')},{body:pr.body.replace(e.ENGINEERING_ID,'87654321-1234-1234-1234-123456789abc')},{body:'x'.repeat(65537)}]) assert.throws(()=>validateRecoveryPR(e,{...pr,...patch},e.TRUSTED_SHA));
});
test('Git binding refuses merged/multiple parents, widened/renamed/symlink scope and changed dependencies',()=>{
  validateRecoveryTree(e,git);
  for(const [command,replacement] of [['rev-list',`${e.EXPECTED_HEAD} ${e.TRUSTED_SHA} ${'c'.repeat(40)}`],['diff',diff+'M\0package.json\0'],['diff',diff.replace('A\0','M\0')],['diff',diff.replace('M\0','R100\0')],['ls-tree',`120000 blob ${'d'.repeat(40)}\tsrc/lib/bloomSupport/constants.ts`],['show','fix: Bloom repair for #495'],['show',git('show')+`Bloom-Engineering-Issue: ${e.ENGINEERING_ID}\n`]]) assert.throws(()=>validateRecoveryTree(e,(...args)=>args[0]===command?replacement:git(...args)));
  assert.throws(()=>validateRecoveryTree(e,(...args)=>args[0]==='rev-parse'&&args[1].startsWith(e.EXPECTED_HEAD)?'e'.repeat(40):git(...args)));
});
test('workflow recovery cannot enter model, publish, or report paths or obtain write credentials',()=>{
  const workflow=readFileSync(new URL('../workflows/bloom-repair.yml',import.meta.url),'utf8');
  const job = name => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z][a-z-]*:\n/)[0];
  for(const name of ['prepare','agent','publish','report']) assert.match(job(name),/if: (?:always\(\) && )?inputs.mode == 'repair'/);
  assert.doesNotMatch(workflow,/inputs.mode != 'verify'/);
  const observer=job('trusted-reproduction');
  assert.match(observer,/if: always\(\).*inputs.mode == 'repair'.*inputs.mode == 'reproduce'/);
  assert.match(observer,/github.ref == 'refs\/heads\/main'/);
  assert.match(observer,/pull-requests: read/);
  assert.doesNotMatch(observer,/secrets\.|: write|codex exec|curl|git push|BLOOM_KEY/);
  assert.match(observer,/GH_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(observer,/--bind-reproduction/);
  assert.match(observer,/inputs.expected_head/);assert.match(observer,/inputs.expected_pr/);
  const observeStep=observer.split('      - name: Observe fixed public recipe')[1];
  assert.doesNotMatch(observeStep,/GH_TOKEN|github.token/);
  assert.match(workflow,/format\('Bloom repair \{0\}', inputs.engineering_issue_id\)/);
  const supervisor=readFileSync(new URL('./bloom-trusted-reproduction.mjs',import.meta.url),'utf8');
  const binding=supervisor.split('export function bindRecovery')[1].split('export function validatedFiles')[0];
  assert.match(binding,/\['api', '--method', 'GET', endpoint\]/);
  assert.doesNotMatch(binding,/'(?:push|checkout|switch|commit|PATCH|POST)'/);
});


test('binding orchestration only reads fixed APIs, fetches immutable SHA and emits verified outputs',()=>{
  const temporary=mkdtempSync(path.join(tmpdir(),'bloom-binding-'));
  try {
    const output=path.join(temporary,'output'); const calls=[];
    const run=(command,args,options)=>{
      calls.push({command,args,options});
      if(command==='gh') return JSON.stringify(args.at(-1).includes('/pulls/')?pr:{object:{sha:e.TRUSTED_SHA}});
      assert.equal(command,'git');
      if(args[2]==='fetch')return '';
      return git(...args.slice(2));
    };
    bindRecovery({...e,GITHUB_OUTPUT:output},run);
    assert.equal(readFileSync(output,'utf8'),`base_sha=${e.TRUSTED_SHA}\nhead_sha=${e.EXPECTED_HEAD}\npr_number=496\n`);
    assert.deepEqual(calls.filter(c=>c.command==='gh').map(c=>c.args),[
      ['api','--method','GET',`repos/${e.REPOSITORY}/pulls/496`],
      ['api','--method','GET',`repos/${e.REPOSITORY}/git/ref/heads/main`],
      ['api','--method','GET',`repos/${e.REPOSITORY}/pulls/496`],
      ['api','--method','GET',`repos/${e.REPOSITORY}/git/ref/heads/main`]
    ]);
    assert.deepEqual(calls.find(c=>c.command==='git'&&c.args[2]==='fetch').args.slice(2),['fetch','--no-tags','origin',e.EXPECTED_HEAD]);
    const before=calls.length;
    assert.throws(()=>bindRecovery({...e,MODE:'repair',GITHUB_OUTPUT:output},run));
    assert.equal(calls.length,before);
  } finally {rmSync(temporary,{recursive:true,force:true});}
});


test('post-fetch mutable PR/main drift is refused before emitting any output',()=>{
  for(const drift of ['head','main','closed']) {
    const temporary=mkdtempSync(path.join(tmpdir(),'bloom-binding-drift-'));
    try {
      const output=path.join(temporary,'output'); let reads=0;
      const run=(command,args)=>{
        if(command==='gh') {
          reads++;
          if(args.at(-1).includes('/pulls/')) return JSON.stringify(reads>2 && drift==='head'?{...pr,head:{...pr.head,sha:'d'.repeat(40)}}:reads>2 && drift==='closed'?{...pr,state:'closed'}:pr);
          return JSON.stringify({object:{sha:reads>2 && drift==='main'?'d'.repeat(40):e.TRUSTED_SHA}});
        }
        if(args[2]==='fetch')return '';
        return git(...args.slice(2));
      };
      assert.throws(()=>bindRecovery({...e,GITHUB_OUTPUT:output},run));
      assert.throws(()=>readFileSync(output),{code:'ENOENT'});
    } finally {rmSync(temporary,{recursive:true,force:true});}
  }
});
