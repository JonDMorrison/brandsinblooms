/** Credential-free live observer. Inputs bind a request; they do NOT prove deployment state.
 * Edge independently checks the provider's authoritative production target before
 * dispatch and after this receipt, along with the current issue version and holds.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTrustedBrowser, runRecipe } from './bloom-public-attachment-recipe.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function liveBinding(e) {
  if(e.REPOSITORY!=='JonDMorrison/brandsinblooms'||!uuid.test(e.ENGINEERING_ID??'')||!uuid.test(e.VERIFICATION_NONCE??'')||
    !/^[a-f0-9]{40}$/.test(e.TRUSTED_SHA??'')||e.RUN_REF!=='refs/heads/main') throw Error('Invalid live request');
  for(const key of ['REPOSITORY_ID','RUN_ID','RUN_ATTEMPT'])if(!/^[1-9][0-9]{0,15}$/.test(e[key]??''))throw Error('Invalid run identity');
  if(typeof e.VERIFICATION_CONTEXT!=='string'||e.VERIFICATION_CONTEXT.length>2048)throw Error('Invalid context');
  const b=JSON.parse(e.VERIFICATION_CONTEXT);
  const keys=['issue_version','head_sha','deployed_sha','deployment_id','ticket_binding','pr_number'];
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).length!==keys.length||keys.some(k=>!Object.hasOwn(b,k)))throw Error('Invalid context fields');
  if(['head_sha','deployed_sha','deployment_id','ticket_binding'].some(key=>typeof b[key]!=='string'))throw Error('Invalid context types');
  if(!Number.isSafeInteger(b.issue_version)||b.issue_version<1||!Number.isSafeInteger(b.pr_number)||b.pr_number<1||
    !/^[a-f0-9]{40}$/.test(b.head_sha)||!/^[a-f0-9]{40}$/.test(b.deployed_sha)||
    !/^dpl_[A-Za-z0-9]{1,100}$/.test(b.deployment_id)||!/^[a-f0-9]{64}$/.test(b.ticket_binding))throw Error('Invalid context values');
  return b;
}
export async function main(e=process.env) {
  const binding=liveBinding(e);
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  if(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==e.TRUSTED_SHA)throw Error('Observer checkout mismatch');
  const digest=file=>createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex');
  const started_at=new Date().toISOString();
  const { chromium }=await import('@playwright/test');
  const browser=await launchTrustedBrowser(chromium);
  console.log(`Sandboxed observer Chrome ${browser.version()}`);
  let observation;
  try {observation=await runRecipe(browser,'https://bloomsuite.app');}
  finally {await browser.close();}
  const receipt={schema:1,mode:'live',recipe:'public-support-attachment-name-v1',repository:e.REPOSITORY,repository_id:e.REPOSITORY_ID,
    workflow_path:'.github/workflows/bloom-repair.yml',run_id:e.RUN_ID,run_attempt:e.RUN_ATTEMPT,trusted_sha:e.TRUSTED_SHA,
    engineering_issue_id:e.ENGINEERING_ID,nonce:e.VERIFICATION_NONCE,...binding,origin:'https://bloomsuite.app',path:'/support/contact',
    started_at,created_at:new Date().toISOString(),observation,
    recipe_digest:digest('.github/scripts/bloom-public-attachment-recipe.mjs'),workflow_digest:digest('.github/workflows/bloom-repair.yml'),
    supervisor_digest:digest('.github/scripts/bloom-trusted-live.mjs'),dependency_lock_digest:digest('package-lock.json'),package_manifest_digest:digest('package.json')};
  mkdirSync(path.join(root,'trusted-live-receipt'),{recursive:true});
  writeFileSync(path.join(root,'trusted-live-receipt/receipt.json'),JSON.stringify(receipt));
  if(observation.outcome!=='green')throw Error('Live behavior not verified');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
