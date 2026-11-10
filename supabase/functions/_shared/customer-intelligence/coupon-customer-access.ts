import type {PersistenceClient} from '../../bloom-assist/types.ts';
export async function isActiveCouponCustomer(client:Pick<PersistenceClient,'from'>,tenantId:string,customerId:string){
 const {data,error}=await client.from('crm_customers').select('id').eq('tenant_id',tenantId).eq('id',customerId)
   .is('deleted_at',null).is('merged_into_customer_id',null).maybeSingle();
 if(error)throw new Error('Cannot verify active coupon customer');
 return Boolean(data);
}
