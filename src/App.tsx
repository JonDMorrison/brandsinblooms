
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ThemeProvider } from './components/theme-provider';
import { NetworkErrorBoundary } from './components/NetworkErrorBoundary';
import { SmartRootRoute } from './components/SmartRootRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';
import { OnboardingGuard } from './components/OnboardingGuard';
import { CompanyProfilePage } from './components/CompanyProfilePage';
import { Homepage } from './components/Homepage';
import { LandingPage } from './components/LandingPage';
import { CompleteLandingPage } from './components/landing/CompleteLandingPage';
import CalendarPage from './pages/CalendarPage';
import SocialPage from './pages/SocialPage';
import DevSocialPageWrapper from './pages/DevSocialPage';
import SocialMediaPage from './pages/SocialMediaPage';
import PricingPage from './pages/PricingPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import SubscriptionPage from './pages/SubscriptionPage';
import AdminPage from './pages/AdminPage';
import TeamPage from './pages/TeamPage';
import ContentLibraryPage from './pages/ContentLibraryPage';
import TestPage from './pages/TestPage';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from './integrations/supabase/client';
import './App.css';

const queryClient = new QueryClient();

function App() {
  console.log('🚀 App: Component rendering');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-react-theme">
        <NetworkErrorBoundary>
          <AuthProvider>
            <SubscriptionProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<SmartRootRoute />} />
                  <Route path="/auth/*" element={
                    <PublicRoute>
                      <div className="grid place-items-center h-screen">
                        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
                      </div>
                    </PublicRoute>
                  } />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/home" element={<ProtectedRoute><OnboardingGuard><Homepage /></OnboardingGuard></ProtectedRoute>} />
                  <Route path="/complete-landing" element={<CompleteLandingPage />} />
                  <Route path="/profile" element={<ProtectedRoute><OnboardingGuard><CompanyProfilePage /></OnboardingGuard></ProtectedRoute>} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogPostPage />} />
                  <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                  <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                  <Route path="/content-library" element={<ProtectedRoute><ContentLibraryPage /></ProtectedRoute>} />
                  <Route path="/test" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/social" element={<ProtectedRoute><SocialPage /></ProtectedRoute>} />
                  <Route path="/dev-social" element={<DevSocialPageWrapper />} />
                  <Route path="/social-media" element={<ProtectedRoute><SocialMediaPage /></ProtectedRoute>} />
                </Routes>
              </Router>
              <Toaster />
            </SubscriptionProvider>
          </AuthProvider>
        </NetworkErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
