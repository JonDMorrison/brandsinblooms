import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Option,Select,Sheet,Stack,Typography} from '@mui/joy';
import {supabase} from '@/integrations/supabase/client';
import {useTenant} from '@/hooks/useTenant';
import {useAdmin} from '@/contexts/AdminContext';
import {loadReportLedger,loadReportedEvidence,type ReportLedger} from '../../../../supabase/functions/_shared/customer-intelligence/load-reported-evidence';
import {compareReportedPeriodSpend,rankReportedPeriodSpend} from '../../../../supabase/functions/_shared/customer-intelligence/reported-period-spend';
import {readAllPages} from '../../../../supabase/functions/_shared/customer-intelligence/query-pages';
import {formatManualSyncAmount} from '@/lib/customer-intelligence/manualSyncJobs';
import type {PersistenceClient} from '../../../../supabase/functions/bloom-assist/types';
export function ReportedPurchaseWorkspace(){
 const {tenant,loading}=useTenant();const admin=useAdmin();
 if(loading||admin.isLoading||(admin.isMasterAdmin&&(!admin.hasHydratedTenantContext||(admin.activeTenantId??null)!==(tenant?.id??null))))return <Typography>Loading company report scope…</Typography>;
 return tenant?.id?<ReportedCompany key={tenant.id} tenantId={tenant.id}/>:<Alert>Select a company to inspect reported spending.</Alert>;
}
export function ReportedCompany({tenantId}:{tenantId:string}){
 const [ledger,setLedger]=useState<ReportLedger[]>([]),[current,setCurrent]=useState(''),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<string[]>([]);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const client=supabase as unknown as PersistenceClient;
 const chosenSource=ledger.find(row=>row.id===current),baselineSource=ledger.find(row=>row.id===baseline);
 const periodOf=(row:ReportLedger)=>({start:row.source_period_start!,end:row.source_period_end!,currency:'CAD'});
 let comparisonIssue='';
 if(chosenSource&&baselineSource){try{compareReportedPeriodSpend([],[],tenantId,periodOf(chosenSource),periodOf(baselineSource));}catch(e){comparisonIssue=e instanceof Error?e.message:'These periods cannot be compared.';}}
 function change(set:(value:string)=>void,value:string){generation.current++;set(value);setResult([]);setError('');setBusy(false);}
 async function run(compare:boolean,loadOnly=false,showBaseline=false){const version=++generation.current;setBusy(true);setError('');setResult([]);try{
  const cutoff=new Date().toISOString();
  if(loadOnly){const rows=await loadReportLedger(client,tenantId,cutoff);if(version===generation.current)setLedger(rows);return;}
  const chosen=ledger.find(row=>row.id===(showBaseline?baseline:current)),prior=ledger.find(row=>row.id===baseline);if(!chosen||compare&&!prior)throw Error('Select the exact source snapshots first.');
  const period=(row:ReportLedger)=>({start:row.source_period_start!,end:row.source_period_end!,currency:'CAD'});
  // Validate eligibility before loading large report facts or customer lists.
  if(compare)compareReportedPeriodSpend([],[],tenantId,period(chosen),period(prior!));
  const {facts,activeImportIds}=await loadReportedEvidence(client,tenantId,cutoff,{historicalImportIds:compare?[baseline,current]:[chosen.id]});
  const customers=await readAllPages<{id:string;tenant_id:string}>((from,to)=>client.from('crm_customers').select('id,tenant_id').eq('tenant_id',tenantId).is('deleted_at',null).is('merged_into_customer_id',null).lte('created_at',cutoff).order('id').range(from,to));
  if(customers.some(row=>row.tenant_id!==tenantId))throw Error('Customer scope mismatch.');
  const population=customers.map(row=>row.id);
  const report=compare?compareReportedPeriodSpend(facts,population,tenantId,period(chosen),period(prior!)):rankReportedPeriodSpend(facts,population,tenantId,period(chosen));
  const rows=report.rows;
  const known=rows.filter(row=>'reported_spend' in row?row.reported_spend!==null:row.current_spend!==null&&row.baseline_spend!==null);
  const sum=(values:number[])=>{let total=0;for(const value of values){total+=value;if(!Number.isSafeInteger(total))throw Error('Reported total exceeds exact monetary range.');}return values.length?formatManualSyncAmount(total):"Unavailable (no supported customer evidence)";};
  const lines=[`${known.length} customers with supported ${compare?'comparable':'selected-period'} evidence; ${rows.length-known.length} unknown.`, `Report period ${chosen.source_period_start} through ${chosen.source_period_end}.`, `Selected source ${chosen.id}: ${activeImportIds.includes(chosen.id)?'active snapshot':'retained historical snapshot'}.`, `Evidence cutoff ${cutoff}. Currency CAD. Missing customer evidence is unknown, never zero.`];
  if(compare){const comparable=rows.filter((row):row is typeof row & {current_spend:number;baseline_spend:number;current_spend_cents:number;baseline_spend_cents:number}=>'current_spend' in row&&row.current_spend!==null&&row.baseline_spend!==null);lines.push(`Same supported cohort: baseline ${sum(comparable.map(r=>r.baseline_spend_cents!))}; current ${sum(comparable.map(r=>r.current_spend_cents!))}.`);}
  else{const ranked=rows.filter((row):row is typeof row & {reported_spend:number;rank:number;reported_spend_cents:number}=>'reported_spend' in row&&row.reported_spend!==null&&row.rank!==null);lines.push(`Selected-period reported spend ${sum(ranked.map(r=>r.reported_spend_cents!))}.`);lines.push(...ranked.slice(0,20).map(row=>`Rank ${row.rank}: customer ${row.customer_id} · ${formatManualSyncAmount(row.reported_spend_cents!)}`));}
  if(version===generation.current)setResult(lines);
 }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Reported evidence unavailable.');}finally{if(version===generation.current)setBusy(false);}}
 return <Sheet variant="outlined" sx={{p:2,borderRadius:'lg'}}><Stack spacing={2}><Typography level="h3">Source-backed reported spending</Typography><Typography>Exact report snapshots only. Product summaries do not establish dated visits, frequency, lifetime value or CGI. Totals below cover customers with supported evidence, not an inferred whole-business total.</Typography><Button disabled={busy} onClick={()=>{setCurrent('');setBaseline('');setLedger([]);void run(false,true);}}>Load completed report sources</Button>{ledger.length>0&&<><Select aria-label="Reported current source" value={current||null} onChange={(_,v)=>change(setCurrent,v??'')} placeholder="Choose current snapshot">{ledger.map(row=><Option key={row.id} value={row.id}>{row.source_period_start} through {row.source_period_end} · {row.source_filename??row.id}</Option>)}</Select><Select aria-label="Reported baseline source" value={baseline||null} onChange={(_,v)=>change(setBaseline,v??'')} placeholder="Choose baseline snapshot">{ledger.map(row=><Option key={row.id} value={row.id}>{row.source_period_start} through {row.source_period_end} · {row.source_filename??row.id}</Option>)}</Select><Button disabled={busy||!current} onClick={()=>void run(false)}>Show selected-period spending and ranking</Button><Button disabled={busy||!baseline} onClick={()=>void run(false,false,true)}>Show baseline-period spending separately</Button>{comparisonIssue&&<Alert color="neutral">{comparisonIssue} You can inspect each report separately; no growth percentage is available for this pair.</Alert>}<Button disabled={busy||!current||!baseline||Boolean(comparisonIssue)} onClick={()=>void run(true)}>Compare exact source periods</Button></>}{error&&<Alert color="warning">{error}</Alert>}{result.map((line,i)=><Typography key={i}>{line}</Typography>)}</Stack></Sheet>;
}
