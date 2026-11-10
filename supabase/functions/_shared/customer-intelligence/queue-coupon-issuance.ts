import {isActiveCouponCustomer} from './coupon-customer-access.ts';
import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {fireAutomationTriggers} from '../automation/fireAutomationTriggers.ts';
import {readAllPages} from './query-pages.ts';
import {loadCustomerCouponLifecycle} from './load-coupon-lifecycle.ts';
import type {CouponEvent} from './coupon-lifecycle.ts';
/** Call only after a verified issued-coupon import completes. Replays repair queueing via existing stable event-key upsert. Does not send messages. */
export async function queueCompletedCouponIssuance(client:Pick<PersistenceClient,'from'>,tenantId:string,importId:string,cutoff=new Date().toISOString()){
 if(!tenantId||!importId||!Number.isFinite(Date.parse(cutoff)))throw new Error('Coupon import scope is required');
 const {data:source,error}=await client.from('customer_intelligence_imports').select('id,status,source,report_type,completed_at')
   .eq('tenant_id',tenantId).eq('id',importId).maybeSingle();
 if(error)throw new Error('Cannot verify completed coupon import');
 if(!source||source.status!=='completed'||source.source!=='ideal'||source.report_type!=='coupons_issued'||!source.completed_at||Date.parse(source.completed_at)>Date.parse(cutoff)||!Number.isFinite(Date.parse(source.completed_at)))return {considered:0,eligible:0};
 const issues=await readAllPages<CouponEvent>((from,to)=>client.from('customer_intelligence_source_events')
   .select('id,tenant_id,customer_id,import_id,source,event_type,coupon_code,occurred_at,expires_at,external_transaction_id,source_fingerprint')
   .eq('tenant_id',tenantId).eq('import_id',importId).eq('source','ideal').eq('event_type','coupon_issued').lte('created_at',cutoff).order('id').range(from,to));
 const byCustomer=new Map<string,CouponEvent[]>();
 for(const issue of issues){if(issue.tenant_id!==tenantId||issue.import_id!==importId)throw new Error('Coupon issuance scope mismatch');if(issue.customer_id)byCustomer.set(issue.customer_id,[...(byCustomer.get(issue.customer_id)??[]),issue]);}
 let eligible=0;
 for(const[customerId,customerIssues]of byCustomer){
   if(!await isActiveCouponCustomer(client,tenantId,customerId))continue;
   const evidence=await loadCustomerCouponLifecycle(client,tenantId,customerId,cutoff);
   for(const issue of customerIssues){
     const lifecycle=evidence.rows.find(r=>r.issued_event_id===issue.id);
     if(!lifecycle||lifecycle.state!=='issued_no_known_redemption')continue;
     await fireAutomationTriggers(client,tenantId,customerId,['ideal.coupon_issued'],{
       event_id:`coupon-issued:${issue.source_fingerprint}`,pos_source:'ideal',coupon_issued_event_id:issue.id,
       coupon_code:issue.coupon_code,issued_at:issue.occurred_at,expires_at:issue.expires_at,source_import_id:importId,
     });eligible++;
   }
 }
 return {considered:issues.length,eligible};
}
