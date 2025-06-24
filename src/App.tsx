import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import SocialPage from './pages/SocialPage';
import AccountPage from './pages/AccountPage';
import BillingPage from './pages/BillingPage';
import ContentTasksPage from './pages/ContentTasksPage';
import CompanyProfilePage from './components/CompanyProfilePage';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import ProfilePage from './pages/ProfilePage';
import UserDataDeletionPage from '@/pages/UserDataDeletionPage';

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
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/social" element={<SocialPage />} />
              <Route path="/content-tasks" element={<ContentTasksPage />} />
              <Route path="/account" element={<ProfilePage />} />
              <Route path="/billing" element={<BillingPage />} />
              
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
