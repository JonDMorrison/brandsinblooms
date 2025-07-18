
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import { Homepage } from '@/components/Homepage';
import { SidebarLayout } from '@/components/SidebarLayout';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { HomepageErrorBoundary } from '@/components/homepage/HomepageErrorBoundary';
import { ContentGenerationProvider } from '@/contexts/ContentGenerationContext';
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

  // Show dashboard for authenticated users, comprehensive landing page for guests
  return (
    <>
      {user ? (
        <ContentGenerationProvider>
          <HomepageErrorBoundary>
            <SidebarLayout>
              <OnboardingGuard>
                <Homepage />
              </OnboardingGuard>
            </SidebarLayout>
          </HomepageErrorBoundary>
        </ContentGenerationProvider>
      ) : (
        <CompleteLandingPage />
      )}
      
      {/* Emergency Auth Reset Component - always available when there are issues */}
      <EmergencyAuthReset />
    </>
  );
};
