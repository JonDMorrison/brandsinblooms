
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
import { useSubscription } from './contexts/SubscriptionContext';
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import SocialPage from './pages/SocialPage';
import { SidebarLayout } from './components/SidebarLayout';

function App() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription } = useSubscription();

  useEffect(() => {
    // Redirect to onboarding if authenticated and no subscription
    if (isAuthenticated && !subscription && location.pathname !== '/onboarding' && location.pathname !== '/auth' && location.pathname !== '/subscription/success') {
      navigate('/onboarding');
    }

    // Redirect to pricing if subscription is free_trial and attempting to access a paid feature
    const paidFeaturesRoutes = ['/campaigns', '/templates']; // Example routes
    if (subscription?.plan === 'free_trial' && paidFeaturesRoutes.includes(location.pathname)) {
      navigate('/pricing');
    }
  }, [isAuthenticated, subscription, navigate, location]);

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
              <SidebarLayout>
                <SocialPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/" element={
            isAuthenticated ? (
              <ProtectedRoute>
                <SidebarLayout>
                  <Index />
                </SidebarLayout>
              </ProtectedRoute>
            ) : (
              <LandingPage />
            )
          } />
          <Route path="/app" element={
            <ProtectedRoute>
              <SidebarLayout>
                <Index />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
    </ThemeProvider>
  );
}

export default App;
