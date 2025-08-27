import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PagePersistenceOptions {
  key: string;
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  onHidden?: () => void;
  onVisible?: () => void;
}

export const usePagePersistence = <T extends Record<string, any>>(
  options: PagePersistenceOptions
) => {
  const location = useLocation();
  const { key, ttl = 60 * 60 * 1000, onHidden, onVisible } = options; // 1 hour default TTL
  
  const persistenceKey = `page_persist_${key}_${location.pathname}`;
  const lastSavedRef = useRef<number>(0);

  // Save state to sessionStorage with TTL
  const persistState = useCallback((state: T) => {
    try {
      const data = {
        state,
        timestamp: Date.now(),
        ttl
      };
      sessionStorage.setItem(persistenceKey, JSON.stringify(data));
      lastSavedRef.current = Date.now();
      console.log('💾 State persisted for', persistenceKey);
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }, [persistenceKey, ttl]);

  // Restore state from sessionStorage
  const restoreState = useCallback((): T | null => {
    try {
      const savedData = sessionStorage.getItem(persistenceKey);
      if (!savedData) return null;

      const { state, timestamp, ttl: savedTtl } = JSON.parse(savedData);
      const age = Date.now() - timestamp;
      
      // Check if data is still valid
      if (age > savedTtl) {
        sessionStorage.removeItem(persistenceKey);
        console.log('🗑️ Expired state removed for', persistenceKey);
        return null;
      }

      console.log('📋 State restored for', persistenceKey, '- age:', Math.round(age / 1000), 'seconds');
      return state;
    } catch (error) {
      console.warn('Failed to restore state:', error);
      return null;
    }
  }, [persistenceKey]);

  // Clear persisted state
  const clearPersistedState = useCallback(() => {
    try {
      sessionStorage.removeItem(persistenceKey);
      console.log('🗑️ State cleared for', persistenceKey);
    } catch (error) {
      console.warn('Failed to clear persisted state:', error);
    }
  }, [persistenceKey]);

  // Listen for visibility changes
  useEffect(() => {
    const handleTabHidden = () => {
      onHidden?.();
    };

    const handleTabVisible = () => {
      onVisible?.();
    };

    window.addEventListener('app:tab-hidden', handleTabHidden);
    window.addEventListener('app:tab-visible', handleTabVisible);

    return () => {
      window.removeEventListener('app:tab-hidden', handleTabHidden);
      window.removeEventListener('app:tab-visible', handleTabVisible);
    };
  }, [onHidden, onVisible]);

  // Cleanup on unmount or route change
  useEffect(() => {
    return () => {
      // Optional: Clear state when component unmounts completely
      // For now, we'll keep it for tab switches
    };
  }, [location.pathname]);

  return {
    persistState,
    restoreState,
    clearPersistedState
  };
};
