import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BUILD, buildSnapshot, safeBuildFailure, pinnedBuildImage } from './bloom-trusted-reproduction.mjs';

test('diagnostics disclose only fixed stage/code/status/signal, never candidate text', () => {
  for (const stage of ['setup', 'config-bundle', 'config-import', 'config-evaluation', 'vite-build']) {
    const error = {status:1, stderr:Buffer.from(`SECRET raw stack\nBLOOM_BUILD_DIAGNOSTIC ${JSON.stringify({stage,code:'EACCES',message:'SECRET'})}\n`)};
    assert.equal(safeBuildFailure(error).message, `Sandbox build failed: stage=${stage} code=EACCES status=1 signal=none`);
  }
  for (const payload of ['not json', '{"stage":"SECRET","code":"SECRET"}', 'x'.repeat(300)]) {
    assert.equal(safeBuildFailure({stderr:Buffer.from(`BLOOM_BUILD_DIAGNOSTIC ${payload}`), signal:'SECRET'}).message,
      'Sandbox build failed: stage=container code=UNKNOWN status=unknown signal=none');
  }
  assert.match(safeBuildFailure({code:'ENOBUFS',status:null}).message, /code=ENOBUFS/);
  assert.doesNotThrow(() => new Function(BUILD));
  for (const stage of ['config-bundle','config-import','config-evaluation','vite-build']) assert.ok(BUILD.includes(`stage = '${stage}'`));
});

test('snapshot retains all restrictions, bounds, output validation and cleanup on success/failure', () => {
  for (const failure of [null, 'build', 'source', 'output']) {
    const temporary = mkdtempSync(path.join(tmpdir(), 'bloom-container-test-'));
    const calls = [];
    const run = (command, args, options) => {
      calls.push({command,args,options});
      if (command === 'git' && args.includes('ls-tree')) return `${failure === 'source' ? '120000' : '100644'} blob ${'a'.repeat(40)}\tindex.html`;
      if (command === 'git') return Buffer.from('archive');
      if (command === 'docker' && args[0] === 'run') {
        if (failure === 'build') throw {status:1,stderr:Buffer.from('private candidate output')};
        if (failure !== 'output') writeFileSync(path.join(temporary, 'baseline-dist/index.html'), '<main>safe</main>');
      }
    };
    try {
      const call = () => buildSnapshot({trusted:'/trusted',temporary,label:'baseline',sha:'a'.repeat(40),image:`sha256:${'b'.repeat(64)}`,container:'test'},run);
      if (failure) assert.throws(call); else assert.equal(call().get('/index.html').toString(), '<main>safe</main>');
      assert.deepEqual(calls.at(-1).args, ['umount',path.join(temporary,'baseline-dist')]);
      const docker = calls.find(c => c.command === 'docker' && c.args[0] === 'run');
      if (failure !== 'source') {
        for (const flag of ['--network=none','--read-only','--user=65532:65532','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=4g','--cpus=2','fsize=268435456:268435456','/tmp:rw,noexec,nosuid,size=256m']) assert.ok(docker.args.includes(flag),flag);
        assert.ok(docker.args.includes('type=bind,src=/trusted/node_modules,dst=/app/node_modules,readonly'));
        assert.ok(docker.args.includes(`type=bind,src=${temporary}/baseline,dst=/app,readonly`));
        assert.deepEqual(docker.options,{timeout:240000,maxBuffer:1<<20,stdio:['ignore','ignore','pipe']});
        assert.ok(calls.some(c => c.command === 'docker' && c.args.join(' ') === 'rm -f test'));
      } else assert.equal(docker,undefined);
      assert.ok(calls[0].args.includes('size=256m,mode=0777,nosuid,nodev,noexec'));
    } finally {rmSync(temporary,{recursive:true,force:true});}
  }
});

test('preflight uses the identical builder with immutable HEAD but cannot issue proof', () => {
  const source=readFileSync(new URL('./bloom-container-preflight.mjs',import.meta.url),'utf8');
  assert.match(source,/buildSnapshot\(/); assert.match(source,/'rev-parse', 'HEAD'/);
  assert.doesNotMatch(source,/writeFile|runRecipe|receipt\.json|launchTrustedBrowser|VERIFICATION_CONTEXT/);
  assert.match(source,/not repair or release proof/);
  assert.throws(()=>pinnedBuildImage(()=> 'node:latest'));
  assert.equal(pinnedBuildImage(()=>`sha256:${'a'.repeat(64)}\n`),`sha256:${'a'.repeat(64)}`);
});


test('hosted preflight has its own clean job and exact observer install mode', () => {
  const workflow = readFileSync(new URL('../workflows/security-gate.yml', import.meta.url), 'utf8');
  const [verify, preflight] = workflow.split('  bloom-build-preflight:\n');
  assert.ok(preflight);
  assert.match(verify, /run: npm ci\n/);
  assert.doesNotMatch(verify, /bloom-container-preflight\.mjs/);
  assert.match(preflight, /timeout-minutes: 20/);
  assert.match(preflight, /permissions:\n      contents: read/);
  assert.match(preflight, /persist-credentials: false/);
  assert.match(preflight, /node-version: 24/);
  assert.match(preflight, /run: npm ci --ignore-scripts\n/);
  assert.match(preflight, /docker pull node:24-bookworm-slim/);
  assert.match(preflight, /node \.github\/scripts\/bloom-container-preflight\.mjs/);
  assert.doesNotMatch(preflight, /secrets\.|contents: write|needs:|npm run|run: npm ci\n/);
});
