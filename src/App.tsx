
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import { Homepage } from '@/components/Homepage';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import OnboardingPage from '@/pages/OnboardingPage';
import CalendarPage from '@/pages/CalendarPage';
import PublishPage from '@/pages/PublishPage';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Analytics } from '@vercel/analytics/react';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/auth" element={<CompleteLandingPage />} />
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Homepage />
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              } />
              <Route path="/publish" element={
                <ProtectedRoute>
                  <PublishPage />
                </ProtectedRoute>
              } />
              <Route path="/crm/campaigns/new" element={
                <ProtectedRoute>
                  <CRMCampaignCreatorPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Toaster />
          <Analytics />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
