import { useSubscription } from './useSubscription';

interface CRMAccessControl {
  hasCRMAccess: boolean;
  loading: boolean;
  subscription: any;
}

export const useCRMAccess = (): CRMAccessControl => {
  const { subscription, loading } = useSubscription();
  
  // Under the new plan, all users have CRM access
  const hasCRMAccess = true;
  
  return {
    hasCRMAccess,
    loading,
    subscription
  };
};