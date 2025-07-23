
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { Toaster } from '@/components/ui/toaster';
import { HomePage } from '@/pages/HomePage';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { PublishPage } from '@/pages/PublishPage';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { CompletedOnboardingRoute } from '@/components/auth/CompletedOnboardingRoute';
import { Analytics } from '@vercel/analytics/react';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <TenantProvider>
            <div className="min-h-screen bg-background">
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                } />
                <Route path="/" element={
                  <ProtectedRoute>
                    <CompletedOnboardingRoute>
                      <HomePage />
                    </CompletedOnboardingRoute>
                  </ProtectedRoute>
                } />
                <Route path="/calendar" element={
                  <ProtectedRoute>
                    <CompletedOnboardingRoute>
                      <CalendarPage />
                    </CompletedOnboardingRoute>
                  </ProtectedRoute>
                } />
                <Route path="/publish" element={
                  <ProtectedRoute>
                    <CompletedOnboardingRoute>
                      <PublishPage />
                    </CompletedOnboardingRoute>
                  </ProtectedRoute>
                } />
                <Route path="/crm/campaigns/new" element={
                  <ProtectedRoute>
                    <CompletedOnboardingRoute>
                      <CRMCampaignCreatorPage />
                    </CompletedOnboardingRoute>
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <Toaster />
            <Analytics />
          </TenantProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
