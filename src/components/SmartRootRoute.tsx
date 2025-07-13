
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import { Homepage } from '@/components/Homepage';
import { AuthenticatedLayout } from '@/components/layouts/AuthenticatedLayout';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { HomepageErrorBoundary } from '@/components/homepage/HomepageErrorBoundary';
import { ContentGenerationProvider } from '@/contexts/ContentGenerationContext';

export const SmartRootRoute = () => {
  const { user, loading } = useAuth();
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

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (loading) {
    return null;
  }

  // Show dashboard for authenticated users, comprehensive landing page for guests
  return user ? (
    <ContentGenerationProvider>
      <HomepageErrorBoundary>
        <AuthenticatedLayout>
          <OnboardingGuard>
            <Homepage />
          </OnboardingGuard>
        </AuthenticatedLayout>
      </HomepageErrorBoundary>
    </ContentGenerationProvider>
  ) : (
    <CompleteLandingPage />
  );
};
