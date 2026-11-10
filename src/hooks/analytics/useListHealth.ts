import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useTenant} from '@/hooks/useTenant';
import {fetchListHealth,summarizeListHealth} from '@/lib/analytics/listHealthData';
export interface ListHealthMetrics {
  totalSent30d:number;bounceCount30d:number;complaintCount30d:number;
  bounceRate:number;complaintRate:number;healthStatus:'healthy'|'warning'|'critical';
  suppressedCount:number;loading:boolean;error:string|null;refetch:()=>Promise<unknown>;
}
export const useListHealth=():ListHealthMetrics=>{
  const {tenant,loading:tenantLoading}=useTenant();
  const query=useQuery({
    queryKey:['analytics-list-health',tenant?.id],enabled:Boolean(tenant?.id),staleTime:60000,
    queryFn:()=>fetchListHealth(supabase,tenant!.id),
  });
  return {...(query.data??summarizeListHealth([],0)),
    loading:tenantLoading||(!!tenant?.id&&query.isPending),
    error:query.error?.message??(!tenantLoading&&!tenant?.id?'Choose a company to view list health.':null),
    refetch:query.refetch};
};
