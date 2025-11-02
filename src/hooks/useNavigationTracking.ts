/**
 * Navigation tracking hook for Uptrace
 * Automatically tracks page navigations and route changes
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { startTransaction, endTransaction } from '@/utils/uptrace';

export function useNavigationTracking() {
  const location = useLocation();

  useEffect(() => {
    const transaction = startTransaction(`page.navigation.${location.pathname}`, 'navigation');
    
    // End transaction after a short delay to capture initial page load time
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
}
