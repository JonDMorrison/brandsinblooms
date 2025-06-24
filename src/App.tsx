
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import CalendarPage from './pages/CalendarPage';
import SocialPage from './pages/SocialPage';
import { CompanyProfilePage } from './components/CompanyProfilePage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import AuthPage from './pages/Auth';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import UserDataDeletionPage from '@/pages/UserDataDeletionPage';
import Index from './pages/Index';

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/" element={<Index />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/social" element={<SocialPage />} />
              <Route path="/account" element={<ProfilePage />} />
              
              {/* Legal pages */}
              <Route path="/legal/user-data-deletion" element={<UserDataDeletionPage />} />
            </Routes>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
