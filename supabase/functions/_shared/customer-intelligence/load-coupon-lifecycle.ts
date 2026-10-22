import type {PersistenceClient} from '../../bloom-assist/types.ts';
import {readAllPages} from './query-pages.ts';
import {couponLifecycles,type CouponEvent} from './coupon-lifecycle.ts';
export async function loadCustomerCouponLifecycle(client:Pick<PersistenceClient,'from'>,tenantId:string,customerId:string,cutoff:string){
  if(!tenantId||!customerId||!Number.isFinite(Date.parse(cutoff)))throw new Error('Coupon customer scope and cutoff are required');
  const events=await readAllPages<CouponEvent>((from,to)=>client.from('customer_intelligence_source_events')
    .select('id,tenant_id,customer_id,import_id,source,event_type,coupon_code,occurred_at,expires_at,external_transaction_id,source_fingerprint,customer_intelligence_imports!inner(id)')
    .eq('tenant_id',tenantId).eq('source','ideal').eq('customer_id',customerId).in('event_type',['coupon_issued','coupon_redeemed'])
    .eq('customer_intelligence_imports.tenant_id',tenantId).eq('customer_intelligence_imports.status','completed')
    .lte('customer_intelligence_imports.completed_at',cutoff).lte('created_at',cutoff).order('id').range(from,to));
  return {rows:couponLifecycles(events,tenantId,customerId,cutoff),cutoff,event_count:events.length};
}
