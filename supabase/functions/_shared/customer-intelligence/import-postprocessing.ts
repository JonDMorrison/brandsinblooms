import type {PersistenceClient} from '../../bloom-assist/types.ts';

/** Retry derived-state writes without reinserting source facts or advancing their timestamp. */
export async function finishIdealImportPostprocessing(
 client:Pick<PersistenceClient,'from'>,
 scope:{tenantId:string;importId:string;reportType:string;accepted:number;duplicates:number;rejected:number;completedAt:string},
){
 const warnings:string[]=[];
 const projectionPending=(scope.accepted>0||scope.duplicates>0)
  &&(scope.reportType==='customer_sales'||scope.reportType==='customer_sales_by_category');
 const projectionLimitation='Ideal purchase metrics require a verified Ideal-specific projection. Existing metrics were preserved; retrying this file will not resolve this limitation.';
 try{
  const payload={tenant_id:scope.tenantId,source_type:'ideal_import',provider:'ideal',status:scope.accepted&&!scope.rejected&&!projectionPending?'active':'attention_required',sync_mode:'manual_import',capabilities:{report_type:scope.reportType},validation_summary:{accepted:scope.accepted,duplicates:scope.duplicates,rejected:scope.rejected,projection_status:projectionPending?'unsupported':'not_required',projection_limitation:projectionPending?projectionLimitation:null},last_validated_at:scope.completedAt,last_data_at:scope.accepted?scope.completedAt:null,activated_at:scope.accepted?scope.completedAt:null};
  if(!Number.isFinite(Date.parse(scope.completedAt)))throw new Error('Missing completion timestamp');
  const {data:prior,error:readError}=await client.from('customer_intelligence_sources')
   .select('id,last_validated_at').eq('tenant_id',scope.tenantId).eq('provider','ideal').maybeSingle();
  if(readError)throw readError;
  if(!prior){
   // A concurrent insert conflicts instead of overwriting a newer source snapshot.
   const {error}=await client.from('customer_intelligence_sources').insert(payload);
   if(error)throw error;
  }else if(prior.last_validated_at===null||Date.parse(prior.last_validated_at)<=Date.parse(scope.completedAt)){
   let update=client.from('customer_intelligence_sources').update(payload)
    .eq('id',prior.id).eq('tenant_id',scope.tenantId).eq('provider','ideal');
   update=prior.last_validated_at===null?update.is('last_validated_at',null):update.eq('last_validated_at',prior.last_validated_at);
   const {data:updated,error}=await update.select('id');
   if(error||updated?.length!==1)throw new Error('Source health changed concurrently');
  }else if(!Number.isFinite(Date.parse(prior.last_validated_at))){throw new Error('Source health timestamp is invalid');}
  // Newer source health is already authoritative; an older replay must not replace it.
 }catch{warnings.push('Source health update is pending. Recorded source facts were retained.');}
 if(projectionPending){
  // The legacy RPC projects pos_orders only and would overwrite Ideal-only totals with zero.
  // Source facts are retained; no unsupported cross-source metric projection is performed.
  warnings.push(projectionLimitation);
 }

 return {postprocessing_pending:warnings.length>0,warnings};
}
