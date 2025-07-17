import { useSubscription } from './useSubscription';

interface CRMAccessControl {
  hasCRMAccess: boolean;
  loading: boolean;
  subscription: any;
}

export const useCRMAccess = (): CRMAccessControl => {
  const { subscription, loading } = useSubscription();
  
  const hasCRMAccess = Boolean(subscription?.crm_enabled);
  
  return {
    hasCRMAccess,
    loading,
    subscription
  };
};