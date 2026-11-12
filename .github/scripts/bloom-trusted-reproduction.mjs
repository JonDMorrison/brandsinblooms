/** Trusted supervisor. Never import candidate modules or consume candidate reports. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, chmodSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTrustedBrowser, runRecipe } from './bloom-public-attachment-recipe.mjs';

export const RECIPE = 'public-support-attachment-name-v1';
export function validateBinding(e) {
  for (const key of ['BASE_SHA', 'HEAD_SHA', 'TRUSTED_SHA']) if (!/^[a-f0-9]{40}$/.test(e[key] ?? '')) throw Error(`Invalid ${key}`);
  for (const key of ['RUN_ID', 'RUN_ATTEMPT', 'PR_NUMBER', 'ISSUE_NUMBER', 'REPOSITORY_ID']) if (!/^[1-9][0-9]{0,15}$/.test(e[key] ?? '')) throw Error(`Invalid ${key}`);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(e.ENGINEERING_ID ?? '')) throw Error('Invalid engineering issue');
  if (e.REPOSITORY !== 'JonDMorrison/brandsinblooms') throw Error('Unsupported repository');
  if (e.BASE_SHA === e.HEAD_SHA) throw Error('No change');
}
export function validatedFiles(root) {
  const files = new Map(); let total = 0;
  function walk(dir, prefix = '') {
    for (const name of readdirSync(dir)) {
      const relative = prefix + name; const absolute = path.join(dir, name); const stat = lstatSync(absolute);
      if (stat.isDirectory()) { walk(absolute, `${relative}/`); continue; }
      if (!stat.isFile() || stat.nlink !== 1) throw Error('Nonregular build output');
      if (stat.size > 32 * 1024 * 1024 || files.size >= 20000 || (total += stat.size) > 256 * 1024 * 1024) throw Error('Build output exceeds bounds');
      files.set('/' + relative, readFileSync(absolute));
    }
  }
  walk(root);
  if (!files.has('/index.html')) throw Error('Missing index.html');
  return files;
}
export async function serve(files) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const key = pathname === '/support/contact' ? '/index.html' : pathname;
    const data = files.get(key);
    if (!data) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(key)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': "connect-src 'none'; form-action 'none'; worker-src 'none'; frame-src 'none'" }).end(data);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
const BUILD_STAGES = ['setup', 'config-bundle', 'vite-import', 'config-import', 'config-evaluation', 'vite-build'];
const BUILD_CODES = ['ENOENT', 'EACCES', 'EROFS', 'ENOMEM', 'ENOSPC', 'ERR_MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED', 'MODULE_NOT_FOUND', 'PLUGIN_ERROR', 'ENOBUFS', 'ETIMEDOUT', 'NATIVE_BINDING_LOAD_FAILED', 'NATIVE_LIBRARY_LOAD_FAILED', 'MISSING_MODULE', 'ERR_REQUIRE_ESM', 'ERR_REQUIRE_ASYNC_MODULE', 'ERR_INVALID_ARG_TYPE', 'ERR_INVALID_ARG_VALUE', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_PACKAGE_IMPORT_NOT_DEFINED', 'ERR_SYSTEM_ERROR', 'ERR_UNSUPPORTED_ESM_URL_SCHEME', 'ERR_UNKNOWN_FILE_EXTENSION', 'ERR_INTERNAL_ASSERTION', 'EPERM', 'EAGAIN', 'EMFILE', 'EINVAL', 'ENOTDIR', 'ENOTSUP', 'DYNAMIC_REQUIRE_UNSUPPORTED', 'NATIVE_PANIC', 'REFERENCE_ERROR', 'TYPE_ERROR', 'SYNTAX_ERROR', 'RANGE_ERROR', 'ASSERTION_ERROR'];
// Only fixed labels leave this traversal. Both graph size and message work are bounded.
export function classifyBuildError(error, codes = BUILD_CODES) {
  const queue = [{ value: error, depth: 0 }], seen = new Set();
  let visited = 0, fallback = 'UNKNOWN', errorClass = 'UNKNOWN';
  const foundCodes = new Set();
  while (queue.length && visited < 8) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value); visited++;
    try {
      if (codes.includes(value.code)) foundCodes.add(value.code);
      const message = typeof value.message === 'string' ? value.message.slice(0, 2048) : '';
      const classes = {ReferenceError:'REFERENCE_ERROR', TypeError:'TYPE_ERROR', SyntaxError:'SYNTAX_ERROR', RangeError:'RANGE_ERROR', AssertionError:'ASSERTION_ERROR'};
      if (errorClass === 'UNKNOWN' && Object.hasOwn(classes, value.name)) errorClass = classes[value.name];
      if (fallback === 'UNKNOWN') {
        if (/dynamic require of .* is not supported|require is not defined in ES module scope/i.test(message)) fallback = 'DYNAMIC_REQUIRE_UNSUPPORTED';
        else if (/thread .*panicked|panic in a function that cannot unwind|failed to spawn thread|rayon.*thread pool/i.test(message)) fallback = 'NATIVE_PANIC';
        else if (/failed to load native binding/i.test(message)) fallback = 'NATIVE_BINDING_LOAD_FAILED';
        else if (/cannot find (?:module|package)|module not found/i.test(message)) fallback = 'MISSING_MODULE';
        else if (/cannot open shared object file|invalid ELF header|wrong ELF class|failed to map segment from shared object|GLIBC_[0-9.]+.*not found/i.test(message)) fallback = 'NATIVE_LIBRARY_LOAD_FAILED';
      }
      if (depth < 3) {
        const children = Array.isArray(value) ? value.slice(0, 8) : [value.cause];
        for (const child of children) {
          if (queue.length + visited >= 8) break;
          queue.push({ value: child, depth: depth + 1 });
        }
      }
    } catch { /* Hostile getters must not expose candidate text or prevent a fixed diagnostic. */ }
  }
  // SWC probes a missing local binary before the actual installed native package.
  // Prefer actionable underlying failures over that expected module-missing probe.
  const priority = ['ERR_DLOPEN_FAILED', 'EACCES', 'EROFS', 'ENOMEM', 'ENOSPC', 'ENOBUFS', 'ETIMEDOUT', 'ENOENT', 'NATIVE_LIBRARY_LOAD_FAILED', 'NATIVE_BINDING_LOAD_FAILED', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'MISSING_MODULE', 'PLUGIN_ERROR'];
  const lowPriority = ['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'MISSING_MODULE', 'PLUGIN_ERROR'];
  const actionable = priority.filter(code => !lowPriority.includes(code));
  for (const code of codes) if (!lowPriority.includes(code) && !actionable.includes(code)) actionable.push(code);
  return [...actionable, ...lowPriority].find(code => foundCodes.has(code)) ?? (fallback !== 'UNKNOWN' ? fallback : errorClass);
}
export const BUILD = `
import { createRequire } from 'node:module';
const require = createRequire('file:///app/package.json');
let stage = 'setup';
(async()=>{
const fs = require('node:fs');
fs.symlinkSync('/app/node_modules', '/tmp/node_modules');
stage = 'config-bundle';
require('/app/node_modules/esbuild').buildSync({entryPoints:['/app/vite.config.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'/tmp/config.mjs',define:{__dirname:JSON.stringify('/app')}});
stage = 'vite-import';
const {build}=await import('/app/node_modules/vite/dist/node/index.js');
stage = 'config-import';
let {default:config}=await import('file:///tmp/config.mjs');
stage = 'config-evaluation';
if(typeof config==='function')config=await config({command:'build',mode:'production'});
stage = 'vite-build';
await build({...config,configFile:false,root:'/app',build:{...config.build,outDir:'/out',emptyOutDir:true}});
})().catch(error=>{
const code = (${classifyBuildError.toString()})(error, ${JSON.stringify(BUILD_CODES)});
process.stderr.write('\\nBLOOM_BUILD_DIAGNOSTIC '+JSON.stringify({stage,code})+'\\n');
process.exit(1);
});
`;
// Candidate text is never relayed. Markers are untrusted diagnostics, never proof.
export function safeBuildFailure(error) {
  let stage = 'container', code = BUILD_CODES.includes(error?.code) ? error.code : 'UNKNOWN';
  const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.subarray(0, 1 << 20).toString('utf8') : '';
  for (const line of stderr.split('\n')) {
    if (!line.startsWith('BLOOM_BUILD_DIAGNOSTIC ') || line.length > 256) continue;
    try {
      const diagnostic = JSON.parse(line.slice('BLOOM_BUILD_DIAGNOSTIC '.length));
      if (BUILD_STAGES.includes(diagnostic.stage) && [...BUILD_CODES, 'UNKNOWN'].includes(diagnostic.code)) {
        stage = diagnostic.stage; code = diagnostic.code;
      }
    } catch {}
  }
  const status = Number.isInteger(error?.status) && error.status >= 0 && error.status <= 255 ? error.status : 'unknown';
  const signal = ['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGSEGV'].includes(error?.signal) ? error.signal : 'none';
  return new Error(`Sandbox build failed: stage=${stage} code=${code} status=${status} signal=${signal}`);
}
export function pinnedBuildImage(run = execFileSync) {
  const image = run('docker', ['image', 'inspect', '--format={{.Id}}', 'node:24-bookworm-slim'], { encoding: 'utf8' }).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw Error('Unpinned Docker image');
  return image;
}
export function buildSnapshot({ trusted, temporary, label, sha, image, container }, run = execFileSync) {
  const source = path.join(temporary, label), out = path.join(temporary, `${label}-dist`);
  mkdirSync(source); mkdirSync(out);
  // Dedicated ephemeral-runner tmpfs bounds total output, including before validation.
  run('sudo', ['mount', '-t', 'tmpfs', '-o', 'size=256m,mode=0777,nosuid,nodev,noexec', 'tmpfs', out], { stdio: 'ignore' });
  try {
    const entries = run('git', ['-C', trusted, 'ls-tree', '-r', sha], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim().split('\n');
    if (entries.some(line => !/^(100644|100755) blob [a-f0-9]{40}\t/.test(line))) throw Error('Nonregular source entry');
    const archive = run('git', ['-C', trusted, 'archive', '--format=tar', sha], { maxBuffer: 128 << 20 });
    run('tar', ['-x', '-C', source, '--no-same-owner', '--no-same-permissions'], { input: archive });
    mkdirSync(path.join(source, 'node_modules'), { recursive: true });
    try {
      // Receipt and supervisor are never mounted; all candidate execution stays isolated.
      run('docker', ['run', '--name', container, '--rm', '--network=none', '--read-only', '--user=65532:65532', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128', '--memory=4g', '--cpus=2', '--ulimit', 'fsize=268435456:268435456', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', '--mount', `type=bind,src=${source},dst=/app,readonly`, '--mount', `type=bind,src=${path.join(trusted, 'node_modules')},dst=/app/node_modules,readonly`, '--mount', `type=bind,src=${out},dst=/out`, '--workdir=/app', image, 'node', '--input-type=module', '-e', BUILD], { timeout: 240000, maxBuffer: 1 << 20, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) { throw safeBuildFailure(error); }
    finally { try { run('docker', ['rm', '-f', container], { stdio: 'ignore' }); } catch {} }
    // Copy bounded regular output to memory only after the container is gone.
    return validatedFiles(out);
  } finally { run('sudo', ['umount', out], { stdio: 'ignore' }); }
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function main(e = process.env) {
  validateBinding(e);
  const trusted = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const git = (...args) => execFileSync('git', ['-C', trusted, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
  if (git('rev-parse', 'HEAD') !== e.TRUSTED_SHA) throw Error('Trusted checkout mismatch');
  if (git('rev-parse', `${e.HEAD_SHA}^`) !== e.BASE_SHA) throw Error('Head is not based on pinned base');
  // Tooling dependencies are selected only from the dispatched trusted lockfile.
  // The candidate Vite configuration executes only inside the untrusted build sandbox.
  for (const sha of [e.BASE_SHA, e.HEAD_SHA]) for (const file of ['package.json', 'package-lock.json']) {
    if (git('rev-parse', `${sha}:${file}`) !== git('rev-parse', `${e.TRUSTED_SHA}:${file}`)) throw Error('Dependency catalogue mismatch');
  }
  const { chromium } = await import('@playwright/test');
  const temporary = mkdtempSync(path.join(tmpdir(), 'bloom-repro-'));
  chmodSync(temporary, 0o755);
  const image = pinnedBuildImage();
  const observations = {};
  let browser;
  try {
    // One process fixes the browser binary across both fresh recipe contexts.
    browser = await launchTrustedBrowser(chromium);
    console.log(`Sandboxed observer Chrome ${browser.version()}`);
    for (const [label, sha] of [['base', e.BASE_SHA], ['head', e.HEAD_SHA]]) {
      const files = buildSnapshot({ trusted, temporary, label, sha, image, container: `bloom-repro-${e.RUN_ID}-${e.RUN_ATTEMPT}-${label}` });
      const server = await serve(files);
      try { observations[label] = await runRecipe(browser, server.origin); }
      finally { await server.close(); }
    }
    const receipt = {
      schema: 1, recipe: RECIPE, repository: e.REPOSITORY, repository_id: e.REPOSITORY_ID,
      workflow_path: '.github/workflows/bloom-repair.yml', created_at: new Date().toISOString(),
      head_tree: git('rev-parse', `${e.HEAD_SHA}^{tree}`),
      run_id: e.RUN_ID, run_attempt: e.RUN_ATTEMPT,
      engineering_issue_id: e.ENGINEERING_ID, github_issue: Number(e.ISSUE_NUMBER), pr_number: Number(e.PR_NUMBER),
      base_sha: e.BASE_SHA, head_sha: e.HEAD_SHA, trusted_sha: e.TRUSTED_SHA,
      dependency_lock_digest: digest(readFileSync(path.join(trusted, 'package-lock.json'))),
      package_manifest_digest: digest(readFileSync(path.join(trusted, 'package.json'))),
      supervisor_digest: digest(readFileSync(path.join(trusted, '.github/scripts/bloom-trusted-reproduction.mjs'))),
      recipe_digest: digest(readFileSync(path.join(trusted, '.github/scripts/bloom-public-attachment-recipe.mjs'))),
      workflow_digest: digest(readFileSync(path.join(trusted, '.github/workflows/bloom-repair.yml'))),
      observations,
    };
    mkdirSync(path.join(trusted, 'trusted-receipt'), { recursive: true });
    writeFileSync(path.join(trusted, 'trusted-receipt/receipt.json'), JSON.stringify(receipt));
    if (observations.base.outcome !== 'reproduced' || observations.head.outcome !== 'green') throw Error('Trusted red/green not established');
  } finally {
    try { if (browser) await browser.close(); }
    finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
