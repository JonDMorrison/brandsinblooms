import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const StartupLoadingManager = () => {
  const { user, loading: authLoading } = useAuth();
  const { setLoading, clearLoading } = useLoading();
  const [startupTimeout, setStartupTimeout] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    // Set a maximum startup time of 15 seconds
    const timeout = setTimeout(() => {
      setStartupTimeout(true);
      clearLoading('auth');
      clearLoading('startup');
      console.warn('⚠️ Startup timeout reached - forcing app to continue');
    }, 15000);

    // Clear timeout when auth completes
    if (!authLoading) {
      clearTimeout(timeout);
      setStartupTimeout(false);
    }

    return () => clearTimeout(timeout);
  }, [authLoading, clearLoading]);

  // Force show app after timeout even if there are issues
  useEffect(() => {
    if (startupTimeout) {
      setForceShow(true);
      // Show a warning but let the app continue
      console.log('⚠️ App startup took longer than expected, continuing anyway');
    }
  }, [startupTimeout]);

  // Don't render anything - this just manages the loading states
  return null;
};