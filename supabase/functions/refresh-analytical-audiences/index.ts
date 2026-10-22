import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';
import {loadCompanyAnalysisFacts} from '../_shared/customer-intelligence/load-analysis-facts.ts';
import {planAudienceRefresh,appendAudienceRefreshPlan} from '../_shared/customer-intelligence/audience-refresh.ts';
import {readAllPages} from '../_shared/customer-intelligence/query-pages.ts';
import type {CustomerSet} from '../_shared/customer-intelligence/purchase-exploration.ts';
serve(async req=>{
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!key||req.headers.get('Authorization')!==`Bearer ${key}`) return new Response('Unauthorized',{status:401});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,key),token=crypto.randomUUID();
 let job: {id:string;tenant_id:string;user_id:string;source_set_id:string;version:number;excluded_ids:string[]}|undefined;
 try{
  const claim=await client.rpc('claim_bloom_audience_refresh',{p_token:token});if(claim.error)throw claim.error;
  job=claim.data?.[0];if(!job)return Response.json({status:'idle'});
  const source=await client.from('bloom_customer_sets').select('payload').eq('id',job.source_set_id).eq('tenant_id',job.tenant_id).eq('user_id',job.user_id).single();if(source.error)throw source.error;
  const saved=source.data.payload as CustomerSet,now=new Date().toISOString();
  const customers=await readAllPages<{id:string}>((from,to)=>client.from('crm_customers').select('id').eq('tenant_id',job!.tenant_id).is('deleted_at',null).is('merged_into_customer_id',null).lte('created_at',now).order('id').range(from,to));
  let plan: ReturnType<typeof planAudienceRefresh>|null=null;
  for(let offset=0;offset<Math.max(customers.length,1);offset+=1000){
    const population=customers.slice(offset,offset+1000).map(c=>c.id),visible=new Set(population);
    const part=planAudienceRefresh({mode:'dynamic',saved,tenantId:job.tenant_id,userId:job.user_id,conversationId:saved.conversation_id,population,facts:population.length?await loadCompanyAnalysisFacts(client,job.tenant_id,now,population):[],excludedIds:job.excluded_ids.filter(id=>visible.has(id)),now});
    plan=appendAudienceRefreshPlan(plan,part);
  }
  if(!plan)throw new Error('Audience refresh produced no plan');
  if(JSON.stringify(plan).length>16000000)throw new Error('Audience exceeds atomic snapshot size limit');
  const finish=await client.rpc('finish_bloom_audience_refresh',{p_id:job.id,p_token:token,p_version:job.version,p_snapshot:plan,p_error:null});if(finish.error||finish.data!==true)throw new Error('Audience refresh commit rejected');
  return Response.json({status:'completed',members:plan.member_ids.length,unknown:plan.unknown_ids.length});
 }catch{
  if(job)await client.rpc('finish_bloom_audience_refresh',{p_id:job.id,p_token:token,p_version:job.version,p_snapshot:null,p_error:'Refresh failed; previous membership preserved. Inspect server diagnostics before retrying.'});
  return Response.json({error:'Refresh failed; previous membership preserved.'},{status:500});
 }
});
