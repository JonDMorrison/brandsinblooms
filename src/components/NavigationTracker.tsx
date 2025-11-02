import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { startTransaction, endTransaction } from '@/utils/uptrace';

/**
 * Component that tracks navigation for Uptrace monitoring
 * Must be rendered inside Router context (within Routes)
 */
export function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    const transaction = startTransaction(`page.navigation.${location.pathname}`, 'navigation');
    
    const timer = setTimeout(() => {
      if (transaction) {
        endTransaction(transaction);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (transaction) {
        endTransaction(transaction);
      }
    };
  }, [location.pathname]);

  return null; // This component doesn't render anything
}
