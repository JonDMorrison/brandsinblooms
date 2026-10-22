import {isActiveCouponCustomer} from './coupon-customer-access.ts';
import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {loadCustomerCouponLifecycle} from './load-coupon-lifecycle.ts';
import {couponReminderDecision,parseCouponReminderConfig} from './coupon-lifecycle.ts';
export async function checkCouponOutboxReminder(client:Pick<PersistenceClient,'from'>,scope:{tenantId:string;customerId?:string;outboxId?:string},now=new Date().toISOString()){
 if(!scope.outboxId)return {allowed:true};
 const {data,error}=await client.from('crm_outbox').select('customer_id,template_data').eq('id',scope.outboxId).eq('tenant_id',scope.tenantId).maybeSingle();
 if(error||!data)return {allowed:false,reason:'coupon_context_unavailable'};
 const metadata=data.template_data;
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||!('coupon_reminder' in metadata)||metadata.coupon_reminder===null)return {allowed:true};
 try{
  const reminder=metadata.coupon_reminder;
  if(!scope.customerId||data.customer_id!==scope.customerId||!reminder||typeof reminder!=='object'||Array.isArray(reminder))return {allowed:false,reason:'coupon_context_invalid'};
  const config=parseCouponReminderConfig(reminder);
  const issuedId=(reminder as Record<string,unknown>).issued_event_id;
  if(!config||typeof issuedId!=='string'||!issuedId)return {allowed:false,reason:'coupon_context_invalid'};
  if(!await isActiveCouponCustomer(client,scope.tenantId,scope.customerId))return {allowed:false,reason:'coupon_customer_unavailable'};
  const evidence=await loadCustomerCouponLifecycle(client,scope.tenantId,scope.customerId,now);
  return couponReminderDecision(evidence.rows,issuedId,config,now);
 }catch{return {allowed:false,reason:'coupon_evidence_unavailable'};}
}
