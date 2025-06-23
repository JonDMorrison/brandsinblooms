import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import Homepage from './pages/Homepage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import OnboardingPage from './pages/OnboardingPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { useSubscription } from './hooks/useSubscription';
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from '@vercel/analytics/react';
import { SocialPage } from './pages/SocialPage';

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

    // Redirect to pricing if subscription is free and attempting to access a paid feature
    const paidFeaturesRoutes = ['/campaigns', '/templates']; // Example routes
    if (subscription?.plan === 'free' && paidFeaturesRoutes.includes(location.pathname)) {
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
          <Route path="/social" element={<ProtectedRoute><SocialPage /></ProtectedRoute>} />
          <Route path="/" element={
            <Route>
              {isAuthenticated ? (
                <ProtectedRoute>
                  <Homepage />
                </ProtectedRoute>
              ) : (
                <LandingPage />
              )}
            </Route>
          } />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      <Analytics />
    </ThemeProvider>
  );
}

export default App;
