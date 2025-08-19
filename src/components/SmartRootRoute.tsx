
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import { EmergencyAuthReset } from '@/components/EmergencyAuthReset';

export const SmartRootRoute = () => {
  const { user, loading, authError, isInLimboState } = useAuth();
  const { setLoading, clearLoading } = useLoading();

  // Manage auth loading state in the global loading context
  useEffect(() => {
    if (loading) {
      setLoading('auth', {
        isLoading: true,
        message: 'Checking authentication...',
        priority: 'auth'
      });
    } else {
      clearLoading('auth');
    }
  }, [loading, setLoading, clearLoading]);

  // Log current state for debugging
  useEffect(() => {
    console.log('🏠 SmartRootRoute state:', {
      hasUser: !!user,
      loading,
      authError,
      isInLimboState,
      currentPath: window.location.pathname
    });
  }, [user, loading, authError, isInLimboState]);

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (loading) {
    return null;
  }

  // Show landing page for unauthenticated users, redirect authenticated users to dashboard
  return (
    <>
      {user ? (
        <Navigate to="/dashboard" replace />
      ) : (
        <CompleteLandingPage />
      )}
      
      {/* Emergency Auth Reset Component - always available when there are issues */}
      <EmergencyAuthReset />
    </>
  );
};
