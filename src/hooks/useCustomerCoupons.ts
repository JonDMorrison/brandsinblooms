import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {loadCustomerCouponLifecycle} from '../../supabase/functions/_shared/customer-intelligence/load-coupon-lifecycle';
export function useCustomerCoupons(tenantId:string|undefined,customerId:string|undefined){
  return useQuery({queryKey:['customer-coupons',tenantId,customerId],enabled:Boolean(tenantId&&customerId),staleTime:30000,
    queryFn:()=>loadCustomerCouponLifecycle(supabase,tenantId!,customerId!,new Date().toISOString())});
}
