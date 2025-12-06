import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PagePersistenceOptions {
  key: string;
  ttl?: number; // Time to live in milliseconds (default: 1 hour)
  onHidden?: () => void;
  onVisible?: () => void;
  /**
   * Optional unique session ID to prevent cross-campaign contamination
   * When provided, persisted state is isolated to this specific session
   */
  sessionId?: string;
}

interface PersistedData<T> {
  state: T;
  timestamp: number;
  ttl: number;
  /**
   * ISO timestamp of the last modification to the persisted data
   * Used to compare against DB lastModifiedAt to determine which is newer
   */
  lastModifiedAt?: string;
}

export const usePagePersistence = <T extends Record<string, any>>(
  options: PagePersistenceOptions
) => {
  const location = useLocation();
  const { key, ttl = 60 * 60 * 1000, onHidden, onVisible, sessionId } = options; // 1 hour default TTL
  
  // CRITICAL FIX: Include sessionId in persistence key to prevent cross-campaign contamination
  // If no sessionId provided, use pathname only (legacy behavior)
  const persistenceKey = sessionId 
    ? `page_persist_${key}_${sessionId}`
    : `page_persist_${key}_${location.pathname}`;
  const lastSavedRef = useRef<number>(0);

  // Save state to sessionStorage with TTL and lastModifiedAt
  const persistState = useCallback((state: T, lastModifiedAt?: string) => {
    try {
      const data: PersistedData<T> = {
        state,
        timestamp: Date.now(),
        ttl,
        lastModifiedAt: lastModifiedAt || new Date().toISOString()
      };
      sessionStorage.setItem(persistenceKey, JSON.stringify(data));
      lastSavedRef.current = Date.now();
      console.log('💾 State persisted for', persistenceKey, 'at', data.lastModifiedAt);
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }, [persistenceKey, ttl]);

  // Restore state from sessionStorage - returns the persisted data including lastModifiedAt
  const restoreState = useCallback((): { state: T; lastModifiedAt?: string } | null => {
    try {
      const savedData = sessionStorage.getItem(persistenceKey);
      if (!savedData) return null;

      const { state, timestamp, ttl: savedTtl, lastModifiedAt } = JSON.parse(savedData) as PersistedData<T>;
      const age = Date.now() - timestamp;
      
      // Check if data is still valid
      if (age > savedTtl) {
        sessionStorage.removeItem(persistenceKey);
        console.log('🗑️ Expired state removed for', persistenceKey);
        return null;
      }

      console.log('📋 State restored for', persistenceKey, '- age:', Math.round(age / 1000), 'seconds, lastModifiedAt:', lastModifiedAt);
      return { state, lastModifiedAt };
    } catch (error) {
      console.warn('Failed to restore state:', error);
      return null;
    }
  }, [persistenceKey]);

  // Get only the lastModifiedAt timestamp without loading full state
  const getPersistedTimestamp = useCallback((): string | null => {
    try {
      const savedData = sessionStorage.getItem(persistenceKey);
      if (!savedData) return null;

      const { timestamp, ttl: savedTtl, lastModifiedAt } = JSON.parse(savedData) as PersistedData<T>;
      const age = Date.now() - timestamp;
      
      // Check if data is still valid
      if (age > savedTtl) {
        return null;
      }

      return lastModifiedAt || null;
    } catch (error) {
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
    clearPersistedState,
    getPersistedTimestamp
  };
};
