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
