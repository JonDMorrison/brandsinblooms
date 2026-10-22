import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {readAllPages} from '../../supabase/functions/_shared/customer-intelligence/query-pages';
import {loadIdealMetricProjection} from '../../supabase/functions/_shared/customer-intelligence/load-ideal-metric-projection';
import type {PersistenceClient} from '../../supabase/functions/bloom-assist/types';
export interface IdealEvidenceSource {id:string;tenant_id:string;source_sha256:string;source_filename:string|null;source_period_start:string;source_period_end:string;}
const client:Pick<PersistenceClient,'from'>=supabase;
export function useCustomerIdealSources(tenantId:string){
 return useQuery({queryKey:['customer-ideal-evidence-sources',tenantId],enabled:Boolean(tenantId),staleTime:30000,
  queryFn:async({signal})=>{
   const cutoff=new Date().toISOString();let expected:number|undefined;
   return readAllPages<IdealEvidenceSource>(async(from,to)=>{
    const {data,error,count}=await client.from('customer_intelligence_imports')
     .select('id,tenant_id,source_sha256,source_filename,source_period_start,source_period_end',{count:'exact'})
     .eq('tenant_id',tenantId).eq('source','ideal').eq('status','completed').eq('report_type','customer_sales_summary')
     .lte('completed_at',cutoff).order('completed_at',{ascending:false}).order('id').range(from,to).abortSignal(signal);
    if(error||count===null||!data||data.length!==Math.min(1000,Math.max(0,count-from))||(expected!==undefined&&expected!==count))throw new Error('Complete source list could not be loaded');
    expected=count;
    for(const source of data)if(source.tenant_id!==tenantId||!source.source_period_start||!source.source_period_end)throw new Error('Source scope needs reconciliation');
    return {data:data as IdealEvidenceSource[],error:null};
   },10000);
  }});
}
export function useCustomerIdealProjection(tenantId:string,customerId:string,source:IdealEvidenceSource|undefined){
 return useQuery({queryKey:['customer-ideal-evidence',tenantId,customerId,source?.id,source?.source_sha256,source?.source_period_start,source?.source_period_end],enabled:Boolean(tenantId&&customerId&&source),staleTime:30000,
  queryFn:({signal})=>{
   if(!source||source.tenant_id!==tenantId)throw new Error('Choose a source for the current company');
   return loadIdealMetricProjection(client,{tenantId,customerId,importId:source.id,sourceSha256:source.source_sha256,startDate:source.source_period_start,endDate:source.source_period_end,timezone:'UTC',cutoff:new Date().toISOString()},signal);
  }});
}
