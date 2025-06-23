
import { useSubscription } from './useSubscription';

export const useProFeatures = () => {
  const { subscription } = useSubscription();
  
  const isPro = subscription?.plan !== 'free';
  
  return { isPro };
};
