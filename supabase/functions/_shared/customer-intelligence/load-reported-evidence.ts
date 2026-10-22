import {legacySummaryCertificate,verifyLegacySummarySnapshot} from './legacy-summary-evidence.ts';
import {idealEvidenceTimestamp} from './ideal-metric-projection.ts';
import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {readAllPages} from './query-pages.ts';
import {currentSummaryImports,periodSummaryFacts,type SummaryImport,type PeriodSummaryEvent} from './period-summary.ts';
export interface ReportLedger extends SummaryImport {tenant_id:string;status:string;source_sha256:string;source_filename:string|null;created_at:string;completed_at:string;}
export async function loadReportLedger(client:PersistenceClient,tenantId:string,cutoff:string):Promise<ReportLedger[]>{
 if(!tenantId||!Number.isFinite(idealEvidenceTimestamp(cutoff)))throw Error('Company and valid evidence cutoff are required.');
 const rows=await readAllPages<ReportLedger>((from,to)=>client.from('customer_intelligence_imports').select('id,tenant_id,status,source,source_sha256,source_filename,source_period_start,source_period_end,created_at,completed_at,reconciliation').eq('tenant_id',tenantId).eq('source','ideal').eq('report_type','customer_sales_summary').eq('status','completed').lte('completed_at',cutoff).lte('created_at',cutoff).order('completed_at',{ascending:false}).order('id').range(from,to));
 for(const row of rows)if(row.tenant_id!==tenantId||row.status!=='completed'||row.source!=='ideal'||!Number.isFinite(idealEvidenceTimestamp(row.completed_at))||idealEvidenceTimestamp(row.completed_at)>idealEvidenceTimestamp(cutoff)||!Number.isFinite(idealEvidenceTimestamp(row.created_at))||idealEvidenceTimestamp(row.created_at)>idealEvidenceTimestamp(cutoff))throw Error('Invalid completed report scope.');
 currentSummaryImports(rows);return rows;
}
/** Select globally before customer filtering. An explicit historical ID is a retained snapshot, never active additive sales. */
export async function loadReportedEvidence(client:PersistenceClient,tenantId:string,cutoff:string,options:{historicalImportIds?:string[];customerIds?:string[]}={}){
 const ledger=await loadReportLedger(client,tenantId,cutoff);const active=currentSummaryImports(ledger);const ids=options.historicalImportIds;
 const selected=ids?ledger.filter(row=>ids.includes(row.id)):active;
 if(ids&&(new Set(ids).size!==ids.length||selected.length!==ids.length))throw Error('Historical report selection is unavailable or ambiguous.');
 if(!selected.length)return {ledger,activeImportIds:active.map(r=>r.id),facts:[]};
 const rows=await readAllPages<PeriodSummaryEvent>((from,to)=>client.from('customer_intelligence_source_events').select('id,tenant_id,customer_id,external_customer_code,import_id,source,created_at,raw_data').eq('tenant_id',tenantId).eq('source','ideal').eq('event_type','purchase_summary').in('import_id',selected.map(row=>row.id)).lte('created_at',cutoff).order('id').range(from,to));
 const certified=new Set<string>();
 for(const parent of selected){const certificate=legacySummaryCertificate(parent);if(certificate){const identities=await readAllPages<{id:string;tenant_id:string;external_id:string|null}>((from,to)=>client.from('crm_customers').select('id,tenant_id,external_id').eq('tenant_id',tenantId).is('deleted_at',null).is('merged_into_customer_id',null).order('id').range(from,to));await verifyLegacySummarySnapshot(rows.filter(row=>row.import_id===parent.id),certificate,identities);certified.add(parent.id);}}
 for(const row of rows){const parent=selected.find(p=>p.id===row.import_id);const raw=row.raw_data as {period_start?:unknown;period_end?:unknown;source_sha256?:unknown}|null;if(!parent||row.tenant_id!==tenantId||row.source!==parent.source||!Number.isFinite(idealEvidenceTimestamp(row.created_at))||idealEvidenceTimestamp(row.created_at)>idealEvidenceTimestamp(cutoff)||(!certified.has(parent.id)&&raw?.source_sha256!==parent.source_sha256)||raw?.period_start!==parent.source_period_start||raw?.period_end!==parent.source_period_end)throw Error('Report facts do not match their completed source ledger.');}
 const allowed=options.customerIds?new Set(options.customerIds):null;const facts=periodSummaryFacts(rows,tenantId).filter(row=>!allowed||(row.customer_id!==null&&allowed.has(row.customer_id)));
 return {ledger,activeImportIds:active.map(r=>r.id),facts};
}
