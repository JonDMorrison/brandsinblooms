/** Names-only planner used by the durable Ideal job worker. Never writes a database. */
import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';
import {sha256} from './ideal-manual-sync-core.mjs';import {hashFile} from './ideal-manual-sync.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function prepareMasterPlan({manifest,bundle,identities,tenantId,sourceSha}) {
 const {manifestSha256,...unsigned}=manifest;
 if(sha256(JSON.stringify(unsigned))!==manifestSha256||manifest.tenantId!==tenantId||manifest.source.sha256!==sourceSha||manifest.reportFamily!=='customer_master'||manifest.status!=='review_required'||manifest.reconciliation.failures.length)throw Error('Master manifest scope or reconciliation differs');
 if(identities.tenantId!==tenantId||!Array.isArray(identities.customers))throw Error('Master identity scope differs');
 const snapshot=identities.customers.map(c=>{if(!uuid.test(c.id)||typeof c.code!=='string'||![c.first_name,c.last_name].every(v=>v===null||typeof v==='string'))throw Error('Invalid names-only identity snapshot');return {id:c.id,code:c.code,first_name:c.first_name,last_name:c.last_name};}).sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(snapshot.map(c=>c.id)).size!==snapshot.length)throw Error('Duplicate identity snapshot row');
 const identitySha=sha256(JSON.stringify({tenantId,customers:snapshot})),byCode=new Map();
 for(const c of snapshot){const group=byCode.get(c.code)??[];group.push(c);byCode.set(c.code,group);}
 const rows=[],locations=new Set(),perSheet=new Map();
 for(const [i,chunk] of manifest.chunks.entries()){
  if(chunk.index!==i||chunk.path!==`chunk-${String(i).padStart(5,'0')}.jsonl`)throw Error('Master chunk order/path differs');
  const file=path.join(bundle,chunk.path);if(fs.statSync(file).size!==chunk.bytes||await hashFile(file)!==chunk.sha256)throw Error('Master chunk digest differs');let count=0;
  for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
   if(Buffer.byteLength(line)>1024*1024)throw Error('Master row too large');
   const r=JSON.parse(line),sheet=manifest.sheets.find(s=>s.name===r.source?.sheet),loc=JSON.stringify([r.source?.sheet,r.source?.row]);
   if(r.kind!=='customer_profile'||typeof r.customerCode!=='string'||!r.customerCode||r.source?.sha256!==sourceSha||!sheet||!Number.isInteger(r.source.row)||r.source.row<1||r.source.row>sheet.sourceRows||locations.has(loc)||sha256(JSON.stringify({kind:r.kind,customerCode:r.customerCode,fields:r.fields}))!==r.payloadHash)throw Error('Master row provenance differs');
   for(const key of ['FIRSTNAME','LASTNAME'])if(r.fields[key]!==undefined&&typeof r.fields[key]!=='string')throw Error('Invalid master name');
   rows.push({code:r.customerCode,first:r.fields.FIRSTNAME??'',last:r.fields.LASTNAME??'',source:{sha256:sourceSha,sheet:r.source.sheet,row:r.source.row}});
   locations.add(loc);perSheet.set(sheet.name,(perSheet.get(sheet.name)??0)+1);count++;if(rows.length>250000)throw Error('Master plan exceeds reviewed row budget');
  }if(count!==chunk.rows)throw Error('Master chunk row count differs');
 }
 if(rows.length!==manifest.counts.normalizedRows||manifest.sheets.some(s=>(perSheet.get(s.name)??0)!==s.normalizedRows)||manifest.sheets.reduce((n,s)=>n+s.sourceRows,0)!==manifest.counts.sourceRows)throw Error('Master row reconciliation differs');
 const sourceCounts=new Map();for(const r of rows)sourceCounts.set(r.code,(sourceCounts.get(r.code)??0)+1);
 const events=[],quarantine=[];let unchanged=0;
 for(const r of rows){const matches=byCode.get(r.code)??[],reason=sourceCounts.get(r.code)!==1?'duplicate_source_code':matches.length===0?'unknown_code':matches.length!==1?'ambiguous_active_code':null;
  if(reason){quarantine.push({source:r.source,reason});continue;}
  const c=matches[0],before={first_name:c.first_name,last_name:c.last_name},after={first_name:r.first.trim()?r.first:c.first_name,last_name:r.last.trim()?r.last:c.last_name};
  if(JSON.stringify(before)===JSON.stringify(after)){unchanged++;continue;}
  const payload={code:r.code,expectedCustomerId:c.id,before,after,source:r.source,identitySha256:identitySha};events.push({...payload,fingerprint:sha256(JSON.stringify(payload))});
 }
 const totals={groups:events.length,items:events.length,cents:0,quarantinedGroups:quarantine.length,quarantinedItems:quarantine.length,unchangedCustomers:unchanged};
 const planSha=sha256(JSON.stringify({version:1,tenantId,sourceSha,manifestSha256,identitySha,events,quarantine,totals}));
 const scope={sourceSha256:sourceSha,manifestSha256,planSha256:planSha,identitySha256:identitySha,updateFields:['first_name','last_name'],totals};
 const summary={sourceRows:manifest.counts.sourceRows,normalizedRows:rows.length,acceptedCustomers:events.length,acceptedItems:events.length,amountCents:0,excludedCustomers:quarantine.length,excludedItems:quarantine.length,unchangedCustomers:unchanged,quarantinedRows:quarantine,failures:[],notices:['Only nonblank first and last names update existing exact CODE matches. Blank names preserve current values.','Contacts, TYPE, consent, balances, classifications and custom fields are preserved. No customers are created, merged or deleted. The existing database trigger updates updated_at when names change.','Unknown, duplicated and ambiguous CODE rows are quarantined. Names changed since review stop the affected batch.'],periodStart:null,periodEnd:null};
 return {planSha,identitySha,events,totals,scope,summary};
}
