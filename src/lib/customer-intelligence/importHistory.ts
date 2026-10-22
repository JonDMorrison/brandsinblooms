import {supabase} from '@/integrations/supabase/client';
export interface ImportHistoryRow {
 id:string;tenant_id:string;source:string;report_type:string;source_filename:string|null;source_sha256:string;
 source_period_start:string|null;source_period_end:string|null;status:string;
 source_row_count:number;accepted_row_count:number;duplicate_row_count:number;rejected_row_count:number;
 started_at:string;completed_at:string|null;created_at:string;error_summary:unknown;
}
interface HistoryQuery extends PromiseLike<{data:ImportHistoryRow[]|null;error:unknown}> {
 abortSignal(signal:AbortSignal):HistoryQuery;select(columns:string):HistoryQuery;eq(column:string,value:string):HistoryQuery;
 order(column:string,options:{ascending:boolean}):HistoryQuery;range(from:number,to:number):HistoryQuery;
}
// This foundation table is not yet present in generated Database types; columns are
// defined by 20260928143000_customer_intelligence_foundation.sql and selected explicitly.
export interface HistoryClient {from(table:'customer_intelligence_imports'):HistoryQuery}
export const IMPORT_HISTORY_PAGE_SIZE=25;
export type ImportHistoryEntry=Omit<ImportHistoryRow,'error_summary'> & {diagnosticCount:number|null};
export async function loadImportHistory(tenantId:string,page:number,client:HistoryClient=supabase as unknown as HistoryClient,signal?:AbortSignal):Promise<{entries:ImportHistoryEntry[];hasMore:boolean}>{
 if(!tenantId.trim())throw Error('Select a company before loading import history.');
 if(!Number.isSafeInteger(page)||page<0||page>100000)throw Error('Invalid import history page.');
 const from=page*IMPORT_HISTORY_PAGE_SIZE;
 let request=client.from('customer_intelligence_imports')
 .select('id,tenant_id,source,report_type,source_filename,source_sha256,source_period_start,source_period_end,status,source_row_count,accepted_row_count,duplicate_row_count,rejected_row_count,started_at,completed_at,created_at,error_summary')
 .eq('tenant_id',tenantId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+IMPORT_HISTORY_PAGE_SIZE);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw Error('Import history could not be loaded.');
 if(!data)throw Error('Import history returned no confirmed result.');
 if(data.some(row=>row.tenant_id!==tenantId))throw Error('Import history company scope mismatch.');
 return {hasMore:data.length>IMPORT_HISTORY_PAGE_SIZE,entries:data.slice(0,IMPORT_HISTORY_PAGE_SIZE).map(({error_summary,...row})=>({...row,diagnosticCount:Array.isArray(error_summary)?error_summary.length:null}))};
}
export function importLedgerExplanation(status:string):string{
 switch(status){
 case 'processing':return 'Incomplete: no final outcome recorded. Verify this import before resubmitting its source.';
 case 'failed':return 'Failed: some changes may already exist. An operator must inspect this import before another attempt.';
 case 'completed_with_errors':return 'Recorded with errors: rejected records need review.';
 case 'completed':return 'Source processing recorded as completed.';
 default:return 'Unrecognized status: completion cannot be confirmed.';
 }
}
