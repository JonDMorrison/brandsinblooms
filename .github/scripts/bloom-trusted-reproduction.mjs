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
const BUILD = `
const fs = require('node:fs');
fs.symlinkSync('/app/node_modules', '/tmp/node_modules');
require('/app/node_modules/esbuild').buildSync({entryPoints:['/app/vite.config.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'/tmp/config.mjs',define:{__dirname:JSON.stringify('/app')}});
(async()=>{const {build}=await import('/app/node_modules/vite/dist/node/index.js');let {default:config}=await import('file:///tmp/config.mjs');if(typeof config==='function')config=await config({command:'build',mode:'production'});await build({...config,configFile:false,root:'/app',build:{...config.build,outDir:'/out',emptyOutDir:true}})})().catch(()=>process.exit(1));
`;
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
  const image = execFileSync('docker', ['image', 'inspect', '--format={{.Id}}', 'node:24-bookworm-slim'], { encoding: 'utf8' }).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw Error('Unpinned Docker image');
  const observations = {};
  const mounts = [];
  let browser;
  try {
    // One process fixes the browser binary across both fresh recipe contexts.
    browser = await launchTrustedBrowser(chromium);
    console.log(`Sandboxed observer Chrome ${browser.version()}`);
    for (const [label, sha] of [['base', e.BASE_SHA], ['head', e.HEAD_SHA]]) {
      const source = path.join(temporary, label), out = path.join(temporary, `${label}-dist`);
      mkdirSync(source); mkdirSync(out);
      // Dedicated ephemeral-runner tmpfs gives a total disk bound, not merely a per-file bound.
      execFileSync('sudo', ['mount', '-t', 'tmpfs', '-o', 'size=256m,mode=0777,nosuid,nodev,noexec', 'tmpfs', out], { stdio: 'ignore' });
      mounts.push(out);
      const entries = git('ls-tree', '-r', sha).split('\n');
      if (entries.some(line => !/^(100644|100755) blob [a-f0-9]{40}\t/.test(line))) throw Error('Nonregular source entry');
      const archive = execFileSync('git', ['-C', trusted, 'archive', '--format=tar', sha], { maxBuffer: 128 << 20 });
      execFileSync('tar', ['-x', '-C', source, '--no-same-owner', '--no-same-permissions'], { input: archive });
      mkdirSync(path.join(source, 'node_modules'), { recursive: true });
      const container = `bloom-repro-${e.RUN_ID}-${e.RUN_ATTEMPT}-${label}`;
      try {
        // Output is a single dedicated disposable directory. Receipt and supervisor are never mounted.
        execFileSync('docker', ['run', '--name', container, '--rm', '--network=none', '--read-only', '--user=65532:65532', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128', '--memory=4g', '--cpus=2', '--ulimit', 'fsize=268435456:268435456', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', '--mount', `type=bind,src=${source},dst=/app,readonly`, '--mount', `type=bind,src=${path.join(trusted, 'node_modules')},dst=/app/node_modules,readonly`, '--mount', `type=bind,src=${out},dst=/out`, '--workdir=/app', image, 'node', '-e', BUILD], { timeout: 240000, stdio: 'ignore' });
      } finally { try { execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' }); } catch {} }
      // No process retains output mounts; copy validated bytes into trusted memory before serving.
      const server = await serve(validatedFiles(out));
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
      for (const mount of mounts.reverse()) execFileSync('sudo', ['umount', mount], { stdio: 'ignore' });
      rmSync(temporary, { recursive: true, force: true });
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
