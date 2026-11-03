// Operator-only staging. Never publishes imports or changes contacts.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {createNormalizer} from './ideal-manual-sync-core.mjs';
const project=process.env.SUPABASE_PROJECT_ID, token=process.env.SUPABASE_ACCESS_TOKEN;
if(!project||!token||project!==process.env.EXPECTED_PROJECT_ID)throw Error('Approved project configuration required');
const quote=v=>v===null?'NULL':`'${String(v).replaceAll("'","''")}'`;
const hash=b=>createHash('sha256').update(b).digest('hex');
async function sql(query){
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error(`Management query failed (${response.status}); no database payload logged`);
 const result=await response.json();if(!Array.isArray(result))throw Error('Unexpected management response');return result;
}
const digestSQL=id=>`select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(source_sheet,source_row,customer_code,customer_id,amount_cents,transactions) order by source_sheet,source_row)::text,'[]'),'UTF8')),'hex') as digest from intelligence_ops.spending_recovery_rows where job_id=${quote(id)}::uuid`;
async function audit(job){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ideal-spending-'));await fs.chmod(dir,0o700);
 try{
  const url=new URL(job.source_url);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.oaiusercontent.com'))throw Error('Unapproved source transport');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`Source download failed (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==Number(job.source_bytes)||hash(bytes)!==job.source_sha256)throw Error('Original source bytes or SHA-256 mismatch');
  await sql(`update intelligence_ops.spending_recovery_jobs set source_url=null,updated_at=now() where id=${quote(job.id)}::uuid and state='reading'`);
  const original=path.join(dir,'original.xls');await fs.writeFile(original,bytes,{mode:0o600});
  const identities=await sql(`select id,external_id from public.crm_customers where tenant_id=${quote(job.tenant_id)}::uuid and deleted_at is null and merged_into_customer_id is null`);
  const byCode=new Map();for(const row of identities){if(!row.external_id)continue;if(byCode.has(row.external_id))throw Error('Ambiguous master customer CODE');byCode.set(row.external_id,row.id);}
  const normalizer=createNormalizer('customer_spending',{periodStart:job.period_start,periodEnd:job.period_end});
  const rows=[];let sheet=null,sourceRows=0,cents=0,transactions=0;
  const child=spawn(process.env.IDEAL_SYNC_PYTHON??'python3',['scripts/ideal-manual-sync-xls.py',original],{stdio:['ignore','pipe','ignore']});
  const done=new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('Decoder could not start')));child.on('close',code=>code===0?resolve():reject(Error('Original decoder failed')));});done.catch(()=>{});
  try{for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
   const raw=JSON.parse(line);if(raw.sheetStart){sheet=raw.sheetStart;continue;}if(raw.sheetEnd)continue;
   sourceRows++;if(sourceRows>2000000)throw Error('Source row limit exceeded');
   const value=normalizer.row(raw.cells,{sheet,row:raw.row,format:'worksheet'});if(!value)continue;
   if(value.kind!=='reported_spending'||!Number.isSafeInteger(value.fields.amountCents)||!Number.isSafeInteger(value.fields.reportedTransactions)||value.fields.reportedTransactions<0)throw Error('Unsupported spending record');
   const code=value.customerCode;
   if(typeof code!=='string'||code.trim()!==code||!code.length||code.length>100)throw Error('Unreviewed customer CODE');
   rows.push({sheet,row:raw.row,code,id:byCode.get(code)??null,cents:value.fields.amountCents,transactions:value.fields.reportedTransactions});
   cents+=value.fields.amountCents;transactions+=value.fields.reportedTransactions;
   if(!Number.isSafeInteger(cents)||rows.length>100000)throw Error('Source accounting limit exceeded');
  }await done;}catch(e){child.kill();await done.catch(()=>{});throw e;}
  const reconciliation=normalizer.finish();
  if(!rows.length||reconciliation.failures.length||!reconciliation.grandTotal||reconciliation.grandTotal.cents!==cents||reconciliation.grandTotal.quantity!==transactions)throw Error('Original printed totals or period did not reconcile');
  if(new Set(rows.map(r=>r.code)).size!==rows.length)throw Error('Duplicate customer CODE in report');
  for(let start=0;start<rows.length;start+=500){
   const values=rows.slice(start,start+500).map(r=>`(${quote(job.id)}::uuid,${quote(r.sheet)},${r.row},${quote(r.code)},${quote(r.id)}::uuid,${r.cents},${r.transactions})`).join(',');
   await sql(`insert into intelligence_ops.spending_recovery_rows(job_id,source_sheet,source_row,customer_code,customer_id,amount_cents,transactions) values ${values}`);
  }
  const [{digest}]=await sql(digestSQL(job.id));
  const matched=rows.filter(r=>r.id),excluded=rows.filter(r=>!r.id);
  const review={source_sha256:job.source_sha256,period_start:job.period_start,period_end:job.period_end,source_rows:sourceRows,normalized_rows:rows.length,matched_rows:matched.length,unmatched_rows:excluded.length,printed_amount_cents:cents,printed_transactions:transactions,matched_amount_cents:matched.reduce((n,r)=>n+r.cents,0),matched_transactions:matched.reduce((n,r)=>n+r.transactions,0),unmatched_amount_cents:excluded.reduce((n,r)=>n+r.cents,0),printed_totals_match:true,original_sha256_verified:true,dated_receipts:false,source_kind:'reported_period_spending'};
  await sql(`update intelligence_ops.spending_recovery_jobs set state='audited',reviewed_sha256=${quote(digest)},review_summary=${quote(JSON.stringify(review))}::jsonb,updated_at=now() where id=${quote(job.id)}::uuid and state='reading'`);
  console.log('Source audit finished. Private review is ready; nothing published.');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
const deadline=Date.now()+8*60*1000;let processed=0;
while(Date.now()<deadline){
 const jobs=await sql(`update intelligence_ops.spending_recovery_jobs set state='reading',updated_at=now() where id=(select id from intelligence_ops.spending_recovery_jobs where state='queued' and source_url is not null order by created_at for update skip locked limit 1) returning id,tenant_id,source_filename,source_sha256,source_bytes,period_start::text,period_end::text,source_url`);
 if(!jobs.length){if(processed>=3)break;await new Promise(r=>setTimeout(r,10000));continue;}
 try{await audit(jobs[0]);processed++;}catch(error){await sql(`update intelligence_ops.spending_recovery_jobs set state='failed',source_url=null,last_error=${quote(error instanceof Error?error.message:'Audit failed')},updated_at=now() where id=${quote(jobs[0].id)}::uuid`);console.error('Source audit stopped safely. Inspect the private job diagnostic.');process.exitCode=1;break;}
}
console.log(`Audited ${processed} source file(s). No production import was activated.`);
