import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type POSPurchaseHealth = Database['public']['Functions']['bloomsuite_pos_purchase_health']['Returns'][number];
export function usePOSPurchaseHealth() {
 const {tenant,loading}=useTenant();
 const {user}=useAuth();
 const query=useQuery({
  queryKey:['pos-purchase-health',user?.id,tenant?.id],
  enabled:!!user&&!!tenant?.id&&!loading,
  staleTime:30000,
  queryFn:async()=>{
   if(!tenant?.id)throw Error('Select a business first.');
   const {data,error}=await supabase.rpc('bloomsuite_pos_purchase_health',{p_expected_tenant:tenant.id});
   if(error)throw error;
   return data;
  },
 });
 return {...query,data:loading?undefined:query.data,scopeLoading:loading};
}
