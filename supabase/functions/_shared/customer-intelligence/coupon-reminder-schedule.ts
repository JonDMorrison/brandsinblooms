import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {loadCustomerCouponLifecycle} from './load-coupon-lifecycle.ts';
import {couponReminderDecision,type CouponReminderConfig} from './coupon-lifecycle.ts';
export async function resolveCouponReminderSchedule(client:Pick<PersistenceClient,'from'>,tenantId:string,customerId:string,triggerData:Record<string,unknown>,config:CouponReminderConfig,now:string){
 const issuedId=typeof triggerData.coupon_issued_event_id==='string'?triggerData.coupon_issued_event_id:'';
 const metadata={...config,issued_event_id:issuedId};
 if(!issuedId)return {metadata,allowed:false,reason:'coupon_evidence_unknown',scheduled_at:null};
 const evidence=await loadCustomerCouponLifecycle(client,tenantId,customerId,now);
 return {metadata,...couponReminderDecision(evidence.rows,issuedId,config,now)};
}
