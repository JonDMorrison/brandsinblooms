import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as XLSX from 'xlsx';
export const hash=x=>createHash('sha256').update(x).digest('hex');
const literal=x=>{if(String(x).includes("$import$"))throw Error("Reserved SQL delimiter in source");return "'"+String(x).replaceAll("'","''")+"'";};
export function parseAnnual(bytes){
 const wb=XLSX.read(bytes,{type:'buffer'});const groups=[];let group=null,department=null,globalRow=0;let grand=null;
 function finish(){if(!group)return;if(!group.subtotal||group.cents!==group.subtotal.cents||Math.abs(group.quantity-group.subtotal.quantity)>0.00001)throw Error('Customer subtotal mismatch');groups.push(group);}
 for(const sheet of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null});for(const [i,r] of rows.entries()){
 globalRow++;const a=String(r[0]??'').trim();const header=/^Customer\s+(.+?)\s+-\s+/.exec(a);
 if(header){finish();group={code:header[1],items:[],cents:0,quantity:0,start:{sheet,row:i+1}};department=null;continue;}
 if(/^DPT\s/.test(String(r[1]??''))){department=String(r[1]);continue;}
 if(a&&typeof r[3]==='string'&&typeof r[8]==='number'&&typeof r[10]==='number'){
 if(!group||!department)throw Error('Unassigned product');const cents=Math.round(r[10]*100);group.items.push([a,r[3],department,r[8],cents/100,globalRow]);group.cents+=cents;group.quantity+=r[8];continue;}
 if(typeof r[7]==='number'&&typeof r[9]==='number'){const total={quantity:r[7],cents:Math.round(r[9]*100)};if(typeof r[11]==='number'){if(!group)throw Error('Unassigned subtotal');group.subtotal=total;}else grand=total;}
 }}finish();if(new Set(groups.map(g=>g.code)).size!==groups.length)throw Error('Repeated customer group');
 if(!grand||groups.reduce((n,g)=>n+g.cents,0)!==grand.cents||Math.abs(groups.reduce((n,g)=>n+g.quantity,0)-grand.quantity)>0.00001)throw Error('Grand total mismatch');return {groups,sourceRows:globalRow};
}
export function planImport({tenantId,sourceSha,filename,start,end,groups,quarantineIndexes,sourceRows,expectedCustomerIds,supersededSources}){
 if(!/^[0-9a-f-]{36}$/.test(tenantId)||!/^[0-9a-f]{64}$/.test(sourceSha)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('Invalid source scope');
 if(new Set(groups.map(g=>g.code)).size!==groups.length)throw Error('Repeated identity');
 const quarantine=new Set(quarantineIndexes);if([...quarantine].some(i=>!Number.isInteger(i)||i<1||i>groups.length))throw Error('Invalid quarantine index');
 const accepted=groups.filter((_,i)=>!quarantine.has(i+1));const excluded=groups.filter((_,i)=>quarantine.has(i+1));
 if(expectedCustomerIds!==undefined&&accepted.some(g=>typeof expectedCustomerIds[g.code]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(expectedCustomerIds[g.code])))throw Error('Reviewed customer IDs missing or invalid');
 const events=accepted.map(g=>{const raw={kind:'purchase_summary',currency:'CAD',period_start:start,period_end:end,source_sha256:sourceSha,source_location:g.start,source_row_numbering:'global workbook row, sheets in source order',items:g.items};return {code:g.code,...(expectedCustomerIds===undefined?{}:{expectedCustomerId:expectedCustomerIds[g.code]}),amount:g.cents/100,raw,fingerprint:hash(JSON.stringify([tenantId,sourceSha,g.code,raw]))};});
 if(supersededSources!==undefined&&(!Array.isArray(supersededSources)||new Set(supersededSources.map(p=>p.sourceSha)).size!==supersededSources.length||supersededSources.some(p=>!/^[0-9a-f]{64}$/.test(p.sourceSha)||p.sourceSha===sourceSha||!/^\d{4}-\d{2}-\d{2}$/.test(p.periodStart)||!/^\d{4}-\d{2}-\d{2}$/.test(p.periodEnd)||p.periodStart>p.periodEnd||p.periodStart<start||p.periodEnd>end)))throw Error('Invalid reviewed supersession scope');
 const planSha=hash(JSON.stringify({tenantId,sourceSha,start,end,events,quarantineIndexes:[...quarantine].sort((a,b)=>a-b),...(supersededSources===undefined?{}:{supersededSources})}));
 const totals={groups:events.length,items:accepted.reduce((n,g)=>n+g.items.length,0),cents:accepted.reduce((n,g)=>n+g.cents,0),quarantinedGroups:excluded.length,quarantinedItems:excluded.reduce((n,g)=>n+g.items.length,0),quarantinedCents:excluded.reduce((n,g)=>n+g.cents,0)};
 const scope=`tenant_id=${literal(tenantId)}::uuid AND source='ideal' AND report_type='customer_sales_summary' AND source_sha256=${literal(sourceSha)}`;
 const lock=`PERFORM pg_advisory_xact_lock(hashtextextended(${literal(tenantId+sourceSha)},0)); ${supersededSources===undefined?'':'LOCK TABLE public.customer_intelligence_imports IN SHARE ROW EXCLUSIVE MODE;'}`;
 const ledger=`SELECT * INTO STRICT imp FROM public.customer_intelligence_imports WHERE ${scope} FOR UPDATE; IF imp.reconciliation->>'plan_sha256' IS DISTINCT FROM ${literal(planSha)} THEN RAISE EXCEPTION 'Import plan differs'; END IF;`;
 const reconciliation={plan_sha256:planSha,...totals,source_rows:sourceRows,quarantine:'excluded exact identities; no customer creation',evidence_kind:'annual product aggregates; no dated visits',source_sha256:sourceSha,...(supersededSources===undefined?{}:{superseded_sources:supersededSources,supersession_mode:'retain_prior_complete_covering_snapshots'}),...(expectedCustomerIds===undefined?{}:{expected_customer_ids:Object.fromEntries(accepted.map(g=>[g.code,expectedCustomerIds[g.code]]))})};
 const supersessionGuard=supersededSources===undefined?'':`
 PERFORM pg_advisory_xact_lock(hashtextextended(${literal(tenantId+'|ideal-product-summaries')},0));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(${literal(JSON.stringify(supersededSources))}::jsonb) p WHERE (SELECT count(*) FROM public.customer_intelligence_imports old WHERE old.tenant_id=imp.tenant_id AND old.source='ideal' AND old.report_type='customer_sales_summary' AND old.status='completed' AND old.source_sha256=p->>'sourceSha' AND old.source_period_start=(p->>'periodStart')::date AND old.source_period_end=(p->>'periodEnd')::date)<>1) THEN RAISE EXCEPTION 'Reviewed prior snapshot changed or incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM public.customer_intelligence_imports old WHERE old.tenant_id=imp.tenant_id AND old.source='ideal' AND old.report_type='customer_sales_summary' AND old.status='completed' AND old.source_sha256<>imp.source_sha256 AND (old.source_period_start IS NULL OR old.source_period_end IS NULL OR (old.source_period_start<=${literal(end)}::date AND old.source_period_end>=${literal(start)}::date)) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${literal(JSON.stringify(supersededSources))}::jsonb) p WHERE old.source_sha256=p->>'sourceSha' AND old.source_period_start=(p->>'periodStart')::date AND old.source_period_end=(p->>'periodEnd')::date)) THEN RAISE EXCEPTION 'Unexpected completed overlapping snapshot'; END IF;`;
 const begin=`DO $import$ DECLARE imp public.customer_intelligence_imports%ROWTYPE; BEGIN ${lock}
 INSERT INTO public.customer_intelligence_imports(tenant_id,source,report_type,source_filename,source_sha256,source_period_start,source_period_end,status,source_row_count,rejected_row_count,reconciliation)
 VALUES(${literal(tenantId)},'ideal','customer_sales_summary',${literal(filename)},${literal(sourceSha)},${literal(start)},${literal(end)},'processing',${sourceRows},${totals.quarantinedItems},${literal(JSON.stringify(reconciliation))}::jsonb) ON CONFLICT(tenant_id,source,report_type,source_sha256) DO NOTHING;
 ${ledger} ${supersessionGuard} END $import$;`;
 const batches=[];
 for(let offset=0;offset<events.length;offset+=500){const data=events.slice(offset,offset+500);batches.push(`DO $import$ DECLARE imp public.customer_intelligence_imports%ROWTYPE; payload jsonb := ${literal(JSON.stringify(data))}::jsonb; BEGIN ${lock} ${ledger} ${supersessionGuard}
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) x WHERE (SELECT count(*) FROM public.crm_customers c WHERE c.tenant_id=imp.tenant_id AND c.external_id=x->>'code' AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)<>1) THEN RAISE EXCEPTION 'Exact active identity changed; batch cancelled'; END IF;
 ${expectedCustomerIds===undefined?'':`IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) x WHERE NOT EXISTS(SELECT 1 FROM public.crm_customers c WHERE c.tenant_id=imp.tenant_id AND c.external_id=x->>'code' AND c.id=(x->>'expectedCustomerId')::uuid AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)) THEN RAISE EXCEPTION 'Reviewed customer ID changed; batch cancelled'; END IF;`}
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) x JOIN public.customer_intelligence_source_events e ON e.tenant_id=imp.tenant_id AND e.source='ideal' AND e.source_fingerprint=x->>'fingerprint' JOIN public.crm_customers c ON c.tenant_id=imp.tenant_id AND c.external_id=x->>'code' ${expectedCustomerIds===undefined?'':"AND c.id=(x->>'expectedCustomerId')::uuid"} AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL WHERE e.external_customer_code IS DISTINCT FROM x->>'code' OR e.import_id<>imp.id OR e.customer_id IS DISTINCT FROM c.id OR e.raw_data IS DISTINCT FROM x->'raw' OR e.amount IS DISTINCT FROM (x->>'amount')::numeric OR e.event_type<>'purchase_summary' OR e.occurred_at IS NOT NULL) THEN RAISE EXCEPTION 'Existing event differs; batch cancelled'; END IF;
 INSERT INTO public.customer_intelligence_source_events(tenant_id,customer_id,import_id,source,event_type,external_customer_code,amount,occurred_at,source_fingerprint,raw_data)
 SELECT imp.tenant_id,c.id,imp.id,'ideal','purchase_summary',x->>'code',(x->>'amount')::numeric,NULL,x->>'fingerprint',x->'raw' FROM jsonb_array_elements(payload) x JOIN public.crm_customers c ON c.tenant_id=imp.tenant_id AND c.external_id=x->>'code' ${expectedCustomerIds===undefined?'':"AND c.id=(x->>'expectedCustomerId')::uuid"} AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL ON CONFLICT(tenant_id,source,source_fingerprint) DO NOTHING;
 END $import$;`);}
 const finish=`DO $import$ DECLARE imp public.customer_intelligence_imports%ROWTYPE; n bigint; items bigint; cents numeric; BEGIN ${lock} ${ledger} ${supersessionGuard}
 SELECT count(*),sum(jsonb_array_length(raw_data->'items')),sum(amount*100) INTO n,items,cents FROM public.customer_intelligence_source_events WHERE tenant_id=imp.tenant_id AND import_id=imp.id AND source='ideal' AND event_type='purchase_summary';
 IF n<>${totals.groups} OR items<>${totals.items} OR cents<>${totals.cents} THEN RAISE EXCEPTION 'Final totals mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.customer_intelligence_source_events e LEFT JOIN public.crm_customers c ON c.id=e.customer_id AND c.tenant_id=e.tenant_id AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL WHERE e.import_id=imp.id AND (e.tenant_id<>imp.tenant_id OR c.id IS NULL OR c.external_id IS DISTINCT FROM e.external_customer_code OR e.occurred_at IS NOT NULL ${expectedCustomerIds===undefined?'':"OR e.customer_id::text IS DISTINCT FROM imp.reconciliation->'expected_customer_ids'->>e.external_customer_code OR (SELECT count(*) FROM public.crm_customers active WHERE active.tenant_id=e.tenant_id AND active.external_id=e.external_customer_code AND active.deleted_at IS NULL AND active.merged_into_customer_id IS NULL)<>1"})) THEN RAISE EXCEPTION 'Final identity scope invalid'; END IF;
 UPDATE public.customer_intelligence_imports SET status='completed',accepted_row_count=${totals.items},completed_at=coalesce(completed_at,now()) WHERE id=imp.id AND status<>'completed'; END $import$;`;
 const bounded=sql=>supersededSources===undefined?sql:`BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; ${sql} COMMIT;`;
 return {sourceSha,planSha,totals,events,begin:bounded(begin),batches:batches.map(bounded),finish:bounded(finish)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [source,matchesFile,out]=process.argv.slice(2);if(!source||!matchesFile||!out)throw Error('Usage: source.xls matching.json private-output-directory');
 const bytes=fs.readFileSync(source),sourceSha=hash(bytes);if(sourceSha!=='a78228ee4dc959d98411f7170dd034f05d9ef9d53f4bfa96d9fd5988ba332a09')throw Error('Unapproved source hash');
 const matched=JSON.parse(fs.readFileSync(matchesFile));if(matched.ambiguous!==0)throw Error('Ambiguous identities');const parsed=parseAnnual(bytes);
 const plan=planImport({tenantId:'c190325a-5da0-49f6-b374-187464762021',sourceSha,filename:'Customer Sales Report 2025.xls.xls',start:'2025-01-01',end:'2025-12-31',...parsed,quarantineIndexes:matched.exceptions.filter(e=>e.matches===0).map(e=>e.index)});
 if(plan.totals.groups!==17912||plan.totals.items!==150130||plan.totals.cents!==332073413)throw Error('Matched scope differs from approval');
 fs.mkdirSync(out,{recursive:true,mode:0o700});for(const [i,sql] of [plan.begin,...plan.batches,plan.finish].entries())fs.writeFileSync(`${out}/${String(i).padStart(3,'0')}.sql`,sql,{mode:0o600});
 fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({sourceSha,planSha:plan.planSha,totals:plan.totals,batches:plan.batches.length},null,2),{mode:0o600});
 console.log(JSON.stringify({sourceSha,planSha:plan.planSha,totals:plan.totals,batches:plan.batches.length}));
}
