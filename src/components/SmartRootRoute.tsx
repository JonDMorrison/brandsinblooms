
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import { Homepage } from '@/components/Homepage';
import { AuthenticatedLayout } from '@/components/layouts/AuthenticatedLayout';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { HomepageErrorBoundary } from '@/components/homepage/HomepageErrorBoundary';
import { ContentGenerationProvider } from '@/contexts/ContentGenerationContext';
import { UnifiedLoadingState } from '@/components/loading/UnifiedLoadingState';

export const SmartRootRoute = () => {
  const { user, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return <UnifiedLoadingState text="Checking authentication..." />;
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
