import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalData } from '@/contexts/GlobalDataContext';

interface RouteStateData {
  scrollPosition?: number;
  selectedItems?: string[];
  viewMode?: string;
  filters?: Record<string, any>;
  [key: string]: any;
}

/**
 * Hook for persisting and restoring route-specific state
 * Automatically saves/restores scroll position and other state when navigating
 */
export const useRouteState = (defaultState: RouteStateData = {}) => {
  const location = useLocation();
  const { saveRouteState, getRouteState } = useGlobalData();
  
  const currentRoute = location.pathname;

  // Save scroll position automatically
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      saveRouteState(currentRoute, { scrollPosition });
    };

    // Throttle scroll events
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => window.removeEventListener('scroll', throttledHandleScroll);
  }, [currentRoute, saveRouteState]);

  // Restore scroll position when route loads
  useEffect(() => {
    const savedState = getRouteState(currentRoute);
    if (savedState?.scrollPosition !== undefined) {
      // Delay scroll restoration to ensure content is rendered
      setTimeout(() => {
        window.scrollTo({
          top: savedState.scrollPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [currentRoute, getRouteState]);

  // Save state to route
  const saveState = useCallback((state: RouteStateData) => {
    const currentState = getRouteState(currentRoute) || {};
    saveRouteState(currentRoute, { ...currentState, ...state });
  }, [currentRoute, saveRouteState, getRouteState]);

  // Get current route state
  const getState = useCallback(() => {
    const savedState = getRouteState(currentRoute);
    return { ...defaultState, ...savedState };
  }, [currentRoute, getRouteState, defaultState]);

  // Update specific state property
  const updateState = useCallback((key: string, value: any) => {
    const currentState = getState();
    saveState({ ...currentState, [key]: value });
  }, [getState, saveState]);

  return {
    saveState,
    getState,
    updateState,
    currentRoute
  };
};