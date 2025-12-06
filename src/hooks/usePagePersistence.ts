import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { newsletterDebug } from '@/utils/newsletterDebug';

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
  /**
   * STEP 7: If true, ignore localStorage drafts when loading
   * Use when switching campaigns or loading templates
   */
  ignoreDrafts?: boolean;
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
  const { key, ttl = 60 * 60 * 1000, onHidden, onVisible, sessionId, ignoreDrafts = false } = options; // 1 hour default TTL
  
  // CRITICAL FIX: Include sessionId in persistence key to prevent cross-campaign contamination
  // If no sessionId provided, use pathname only (legacy behavior)
  const persistenceKey = sessionId 
    ? `page_persist_${key}_${sessionId}`
    : `page_persist_${key}_${location.pathname}`;
  const lastSavedRef = useRef<number>(0);
  
  // STEP 7: Track if this is a fresh session (campaign/template switch)
  const isFreshSessionRef = useRef(false);

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
      newsletterDebug.log('persistence', `State persisted for ${persistenceKey}`, { 
        lastModifiedAt: data.lastModifiedAt,
        stateKeys: Object.keys(state) 
      });
    } catch (error) {
      newsletterDebug.warn('persistence', 'Failed to persist state', error);
    }
  }, [persistenceKey, ttl]);

  // Restore state from sessionStorage - returns the persisted data including lastModifiedAt
  const restoreState = useCallback((): { state: T; lastModifiedAt?: string } | null => {
    // STEP 7: If ignoreDrafts is true, don't restore from localStorage
    if (ignoreDrafts) {
      newsletterDebug.log('persistence', `Ignoring drafts for ${persistenceKey} (ignoreDrafts=true)`);
      return null;
    }
    
    try {
      const savedData = sessionStorage.getItem(persistenceKey);
      if (!savedData) return null;

      const { state, timestamp, ttl: savedTtl, lastModifiedAt } = JSON.parse(savedData) as PersistedData<T>;
      const age = Date.now() - timestamp;
      
      // Check if data is still valid
      if (age > savedTtl) {
        sessionStorage.removeItem(persistenceKey);
        newsletterDebug.log('persistence', `Expired state removed for ${persistenceKey}`);
        return null;
      }

      newsletterDebug.log('persistence', `State restored for ${persistenceKey}`, {
        age: Math.round(age / 1000) + 's',
        lastModifiedAt
      });
      return { state, lastModifiedAt };
    } catch (error) {
      newsletterDebug.warn('persistence', 'Failed to restore state', error);
      return null;
    }
  }, [persistenceKey, ignoreDrafts]);

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
      newsletterDebug.log('persistence', `State cleared for ${persistenceKey}`);
    } catch (error) {
      newsletterDebug.warn('persistence', 'Failed to clear persisted state', error);
    }
  }, [persistenceKey]);
  
  // STEP 7: Mark this session as fresh (used after DB save or campaign switch)
  const markAsFreshSession = useCallback(() => {
    isFreshSessionRef.current = true;
    clearPersistedState();
    newsletterDebug.log('persistence', `Marked as fresh session for ${persistenceKey}`);
  }, [clearPersistedState, persistenceKey]);

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
    getPersistedTimestamp,
    markAsFreshSession,
    isFreshSession: isFreshSessionRef.current,
  };
};
