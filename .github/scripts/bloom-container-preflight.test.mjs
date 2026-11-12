import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BUILD, buildSnapshot, safeBuildFailure, pinnedBuildImage, classifyBuildError } from './bloom-trusted-reproduction.mjs';

test('diagnostics disclose only fixed stage/code/status/signal, never candidate text', () => {
  for (const stage of ['setup', 'config-bundle', 'vite-import', 'config-import', 'config-evaluation', 'vite-build']) {
    const error = {status:1, stderr:Buffer.from(`SECRET raw stack\nBLOOM_BUILD_DIAGNOSTIC ${JSON.stringify({stage,code:'EACCES',message:'SECRET'})}\n`)};
    assert.equal(safeBuildFailure(error).message, `Sandbox build failed: stage=${stage} code=EACCES status=1 signal=none`);
  }
  for (const payload of ['not json', '{"stage":"SECRET","code":"SECRET"}', 'x'.repeat(300)]) {
    assert.equal(safeBuildFailure({stderr:Buffer.from(`BLOOM_BUILD_DIAGNOSTIC ${payload}`), signal:'SECRET'}).message,
      'Sandbox build failed: stage=container code=UNKNOWN status=unknown signal=none');
  }
  assert.match(safeBuildFailure({code:'ENOBUFS',status:null}).message, /code=ENOBUFS/);
  assert.match(BUILD, /const require = createRequire\('file:\/\/\/app\/package.json'\)/);
  for (const stage of ['config-bundle','vite-import','config-import','config-evaluation','vite-build']) assert.ok(BUILD.includes(`stage = '${stage}'`));
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
        for (const flag of ['--input-type=module','--network=none','--read-only','--user=65532:65532','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=4g','--cpus=2','fsize=268435456:268435456','/tmp:rw,noexec,nosuid,size=256m']) assert.ok(docker.args.includes(flag),flag);
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


test('nested native diagnostics inspect bounded causes and arrays without exposing text', () => {
  const missing = Object.assign(new Error('private path'), {code:'MODULE_NOT_FOUND'});
  const dlopen = Object.assign(new Error('private native path'), {code:'ERR_DLOPEN_FAILED'});
  assert.equal(classifyBuildError(new Error('Failed to load native binding', {cause:[missing,dlopen]})), 'ERR_DLOPEN_FAILED');
  assert.equal(classifyBuildError({cause:[missing,{code:'PLUGIN_ERROR'},{code:'EROFS'}]}), 'EROFS');
  assert.equal(classifyBuildError(new Error('Failed to load native binding', {cause:[missing]})), 'MODULE_NOT_FOUND');
  assert.equal(classifyBuildError(new Error('private Rollup wrapper', {cause:Object.assign(new Error('private library'), {code:'ERR_DLOPEN_FAILED'})})), 'ERR_DLOPEN_FAILED');
  assert.equal(classifyBuildError(new Error('Failed to load native binding SECRET')), 'NATIVE_BINDING_LOAD_FAILED');
  assert.equal(classifyBuildError(new Error('Cannot find package SECRET')), 'MISSING_MODULE');
  assert.equal(classifyBuildError(new Error('SECRET cannot open shared object file')), 'NATIVE_LIBRARY_LOAD_FAILED');
  assert.equal(classifyBuildError({cause:{cause:{cause:missing}}}), 'MODULE_NOT_FOUND');
  assert.equal(classifyBuildError({cause:{cause:{cause:{cause:missing}}}}), 'UNKNOWN');
  assert.equal(classifyBuildError({cause:[...Array.from({length:6},()=>({})),missing]}), 'UNKNOWN');
  const cycle = {}; cycle.cause = cycle;
  assert.equal(classifyBuildError(cycle), 'UNKNOWN');
  assert.equal(classifyBuildError({get code(){throw new Error('SECRET');}}), 'UNKNOWN');
  assert.equal(classifyBuildError(new Error('x'.repeat(2048)+'Cannot find module SECRET')), 'UNKNOWN');
  assert.equal(classifyBuildError({code:'SECRET',message:'SECRET'}), 'UNKNOWN');
  // The in-container classifier is the same tested implementation, not a divergent copy.
  assert.ok(BUILD.includes(classifyBuildError.toString()));
  const error = safeBuildFailure({status:1,stderr:Buffer.from('BLOOM_BUILD_DIAGNOSTIC {"stage":"vite-import","code":"NATIVE_BINDING_LOAD_FAILED"}')});
  assert.equal(error.message,'Sandbox build failed: stage=vite-import code=NATIVE_BINDING_LOAD_FAILED status=1 signal=none');
});


test('import/system codes and fixed error classes remain safe bounded diagnostics', () => {
  for (const code of ['ERR_REQUIRE_ESM','ERR_REQUIRE_ASYNC_MODULE','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_PACKAGE_PATH_NOT_EXPORTED','ERR_PACKAGE_IMPORT_NOT_DEFINED','ERR_SYSTEM_ERROR','ERR_UNSUPPORTED_ESM_URL_SCHEME','ERR_UNKNOWN_FILE_EXTENSION','ERR_INTERNAL_ASSERTION','EPERM','EAGAIN','EMFILE','EINVAL','ENOTDIR','ENOTSUP']) {
    assert.equal(classifyBuildError({cause:[{code:'MODULE_NOT_FOUND'},{code,message:'PRIVATE'}]}),code);
    assert.match(safeBuildFailure({stderr:Buffer.from(`BLOOM_BUILD_DIAGNOSTIC ${JSON.stringify({stage:'config-import',code})}`)}).message,new RegExp(`code=${code} `));
  }
  for (const [error,label] of [[new ReferenceError('PRIVATE'),'REFERENCE_ERROR'],[new TypeError('PRIVATE'),'TYPE_ERROR'],[new SyntaxError('PRIVATE'),'SYNTAX_ERROR'],[new RangeError('PRIVATE'),'RANGE_ERROR']]) assert.equal(classifyBuildError(error),label);
  assert.equal(classifyBuildError(new Error('Dynamic require of "PRIVATE" is not supported')), 'DYNAMIC_REQUIRE_UNSUPPORTED');
  assert.equal(classifyBuildError(new Error("thread 'PRIVATE' panicked at PRIVATE")), 'NATIVE_PANIC');
  assert.equal(classifyBuildError({name:'PRIVATE',message:'PRIVATE'}),'UNKNOWN');
  assert.equal(classifyBuildError({name:'constructor'}),'UNKNOWN');
});


test('CommonJS eval leaks an invalid plugin filename; ESM eval preserves module-local require', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'bloom-eval-mode-'));
  try {
    const plugin = path.join(temporary, 'plugin.mjs');
    // Exact import-time expression in @vitejs/plugin-react-swc, not a mocked outcome.
    writeFileSync(plugin, `import { createRequire } from 'node:module';
export const resolve = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url).resolve;`);
    const expression = `import(${JSON.stringify(pathToFileURL(plugin).href)}).catch(error => { process.stderr.write(error.code); process.exit(1); });`;
    const red = spawnSync(process.execPath, ['-e',expression], {encoding:'utf8',timeout:10000});
    assert.equal(red.status,1); assert.equal(red.stderr,'ERR_INVALID_ARG_VALUE');
    const greenExpression = `import { createRequire } from 'node:module'; const require = createRequire(${JSON.stringify(pathToFileURL(path.join(temporary,'package.json')).href)}); require('node:fs'); ` + expression;
    const green = spawnSync(process.execPath, ['--input-type=module','-e',greenExpression], {encoding:'utf8',timeout:10000});
    assert.equal(green.status,0,green.stderr); assert.equal(green.stderr,'');
    const syntax = spawnSync(process.execPath,['--input-type=module','--check'],{input:BUILD,encoding:'utf8',timeout:10000});
    assert.equal(syntax.status,0,syntax.stderr);
  } finally {rmSync(temporary,{recursive:true,force:true});}
});
