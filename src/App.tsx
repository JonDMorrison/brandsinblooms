
import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import { LandingPage } from './components/LandingPage';
import PricingPage from './pages/PricingPage';
import OnboardingPage from './pages/OnboardingPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import Index from './pages/Index';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { OnboardingGuard } from './components/OnboardingGuard';
import { useSubscription } from './contexts/SubscriptionContext';
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import SocialPage from './pages/SocialPage';
import { SidebarLayout } from './components/SidebarLayout';

function App() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  // Only handle specific redirects after both auth and subscription are loaded
  useEffect(() => {
    // Don't do any redirects while still loading
    if (authLoading || subscriptionLoading) {
      return;
    }

    // Only redirect to pricing if subscription is expired and user is trying to access paid features
    const paidFeaturesRoutes = ['/campaigns', '/templates'];
    if (isAuthenticated && subscription?.plan === 'expired' && paidFeaturesRoutes.includes(location.pathname)) {
      navigate('/pricing');
    }
  }, [isAuthenticated, subscription, navigate, location, authLoading, subscriptionLoading]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-react-theme">
      <Toaster />
        <Routes>
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/subscription/success" element={<ProtectedRoute><SubscriptionSuccessPage /></ProtectedRoute>} />
          <Route path="/social" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <SidebarLayout>
                  <SocialPage />
                </SidebarLayout>
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/" element={
            isAuthenticated ? (
              <ProtectedRoute>
                <OnboardingGuard>
                  <SidebarLayout>
                    <Index />
                  </SidebarLayout>
                </OnboardingGuard>
              </ProtectedRoute>
            ) : (
              <LandingPage />
            )
          } />
          <Route path="/app" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <SidebarLayout>
                  <Index />
                </SidebarLayout>
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
    </ThemeProvider>
  );
}

export default App;
