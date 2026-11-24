import type {SupabaseClient} from '@supabase/supabase-js';
import {readAllPages} from '../../../supabase/functions/_shared/customer-intelligence/query-pages';
export const LIST_HEALTH_EVENTS=['sent','bounced','bounce','complained','complaint'];
export interface ListHealthEvent {event_type:string;customer_email:string|null;}
export function summarizeListHealth(events:ListHealthEvent[],suppressedCount:number) {
  const sent=new Set<string>(),bounced=new Set<string>(),complained=new Set<string>();
  for(const event of events){
    if(!event.customer_email)continue;
    if(event.event_type==='sent')sent.add(event.customer_email);
    else if(['bounced','bounce'].includes(event.event_type))bounced.add(event.customer_email);
    else if(['complained','complaint'].includes(event.event_type))complained.add(event.customer_email);
  }
  const bounceRate=sent.size?bounced.size/sent.size*100:0;
  const complaintRate=sent.size?complained.size/sent.size*100:0;
  const healthStatus:'healthy'|'warning'|'critical'=bounceRate>=5||complaintRate>=.3?'critical':bounceRate>=2||complaintRate>=.1?'warning':'healthy';
  return {totalSent30d:sent.size,bounceCount30d:bounced.size,complaintCount30d:complained.size,
    bounceRate:Math.round(bounceRate*100)/100,complaintRate:Math.round(complaintRate*1000)/1000,
    healthStatus,suppressedCount};
}
export async function fetchListHealth(client:SupabaseClient,tenantId:string,now=new Date()) {
  if(!tenantId)throw new Error('Choose a company before loading list health.');
  const cutoff=now.toISOString(),start=new Date(now.getTime()-30*86400000).toISOString();
  const [events,suppressions]=await Promise.all([
    readAllPages<ListHealthEvent>((from,to)=>client.from('email_tracking_events')
      .select('event_type, customer_email')
      .eq('tenant_id',tenantId).in('event_type',LIST_HEALTH_EVENTS)
      .gte('created_at',start).lte('created_at',cutoff)
      .order('created_at').order('id').range(from,to)),
    client.from('suppression_list').select('id',{count:'exact',head:true}).eq('tenant_id',tenantId),
  ]);
  if(suppressions.error)throw new Error(suppressions.error.message);
  if(suppressions.count===null)throw new Error('Suppression count was not returned.');
  return summarizeListHealth(events,suppressions.count);
}

export interface ListHealthScoreInput {
  bounceRate:number;complaintRate:number;healthStatus:'healthy'|'warning'|'critical';
  /** Contacts that can receive email (email_reachability_summary.reachable). */
  reachable:number|null;
  /** All contacts in scope (email_reachability_summary.total). */
  total:number|null;
}
export interface ListHealthScore {
  score:number;status:'healthy'|'warning'|'critical'|'unknown';label:string;
  reachablePercent:number|null;explanation:string;
}
/**
 * One list health score that factors in reachability. Bounce and complaint
 * rates alone read 100% on a list nobody can be emailed, so the score is
 * capped by the share of reachable contacts, and 0 reachable is critical.
 */
export function scoreListHealth(input:ListHealthScoreInput):ListHealthScore {
  const deliverability=Math.max(0,Math.min(100,100-input.bounceRate*10-input.complaintRate*100));
  if(input.total===null||input.reachable===null){
    return {score:Math.round(deliverability),status:'unknown',label:'Reachability unknown',reachablePercent:null,
      explanation:'Reachability could not be loaded, so this score only reflects bounces and complaints.'};
  }
  if(input.total===0){
    return {score:0,status:'unknown',label:'No contacts yet',reachablePercent:null,
      explanation:'There are no contacts to measure yet.'};
  }
  const reachablePercent=Math.round(input.reachable/input.total*1000)/10;
  if(input.reachable===0){
    return {score:0,status:'critical',label:'No reachable contacts',reachablePercent:0,
      explanation:'No contact can receive email yet: nobody has given email permission, or every address is suppressed.'};
  }
  const score=Math.round(Math.min(deliverability,reachablePercent));
  const reachStatus:'healthy'|'warning'|'critical'=reachablePercent<20?'critical':reachablePercent<50?'warning':'healthy';
  const rank={healthy:0,warning:1,critical:2} as const;
  const status=rank[reachStatus]>rank[input.healthStatus]?reachStatus:input.healthStatus;
  return {score,status,label:status==='healthy'?'Healthy':status==='warning'?'Needs attention':'Critical',reachablePercent,
    explanation:`${reachablePercent}% of contacts can receive email. The score is the lower of reachability and bounce/complaint health.`};
}
