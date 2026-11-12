/** Infrastructure check only: no browser observation, receipt, or release authority. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, pinnedBuildImage } from './bloom-trusted-reproduction.mjs';

const trusted = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = execFileSync('git', ['-C', trusted, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Invalid preflight checkout');
const image = pinnedBuildImage();
const temporary = mkdtempSync(path.join(tmpdir(), 'bloom-build-preflight-'));
chmodSync(temporary, 0o755);
try {
  buildSnapshot({ trusted, temporary, label: 'baseline', sha, image, container: `bloom-build-preflight-${process.pid}` });
  console.log('Sandbox build infrastructure preflight passed (not repair or release proof).');
} finally { rmSync(temporary, { recursive: true, force: true }); }
