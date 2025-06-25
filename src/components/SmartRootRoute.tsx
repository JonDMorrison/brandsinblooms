
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import { Homepage } from '@/components/Homepage';
import { SidebarLayout } from '@/components/SidebarLayout';
import { OnboardingGuard } from '@/components/OnboardingGuard';
import { HomepageErrorBoundary } from '@/components/homepage/HomepageErrorBoundary';
import { Loader2 } from 'lucide-react';

export const SmartRootRoute = () => {
  const { user, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-garden-green" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Show dashboard for authenticated users, comprehensive landing page for guests
  return user ? (
    <HomepageErrorBoundary>
      <SidebarLayout>
        <OnboardingGuard>
          <Homepage />
        </OnboardingGuard>
      </SidebarLayout>
    </HomepageErrorBoundary>
  ) : (
    <CompleteLandingPage />
  );
};
