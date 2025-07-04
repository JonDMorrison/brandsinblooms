
import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ContentGenerationProvider } from './contexts/ContentGenerationContext';
import { SmartRootRoute } from './components/SmartRootRoute';
import Onboarding from './pages/OnboardingPage';
import PricingPage from './pages/PricingPage';
import AccountSettings from './pages/AccountPage';
import CompanyProfile from './pages/ProfilePage';
import SocialAccounts from './pages/SocialPage';
import BillingPage from './pages/BillingPage';
import CalendarPage from './pages/CalendarPage';
import TeamPage from './pages/TeamPage';
import ContentImportPage from './pages/ContentLibraryPage';
import ReviewQueuePage from './pages/ContentTasksPage';
import DevSocialPageWrapper from './pages/DevSocialPage';
import PublishPage from "./pages/PublishPage";
import NewDashboard from "./pages/NewDashboard";

import SuccessPage from "./pages/SuccessPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ZapierPage from "./pages/ZapierPage";
import AutomationPage from "./pages/AutomationPage";
import Auth from "./pages/Auth";
import AuthCallbackPage from "./pages/AuthCallbackPage";

import { Toaster } from './components/ui/sonner';
import { SocialMediaIntegrationTest } from './components/test/SocialMediaIntegrationTest';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <SubscriptionProvider>
          <ContentGenerationProvider>
            <Routes>
              <Route path="/" element={<SmartRootRoute />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/new-dashboard" element={<NewDashboard />} />
              <Route path="/social" element={<Navigate to="/social-accounts" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/test" element={<div style={{padding: '20px', fontSize: '24px', color: 'green'}}>🧪 Auth Test Route Working! URL: {window.location.href}</div>} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/onboarding/manual" element={<Onboarding />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/profile" element={<CompanyProfile />} />
              <Route path="/company-profile" element={<CompanyProfile />} />
              <Route path="/social-accounts" element={<SocialAccounts />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/content-import" element={<ContentImportPage />} />
              <Route path="/review-queue" element={<ReviewQueuePage />} />
              <Route path="/dev-social" element={<DevSocialPageWrapper />} />
              <Route path="/publish" element={<PublishPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/integrations/zapier" element={<ZapierPage />} />
              <Route path="/automation" element={<AutomationPage />} />
              <Route path="/test/social-integration" element={
                <div className="container mx-auto p-8">
                  <SocialMediaIntegrationTest />
                </div>
              } />
            </Routes>
          </ContentGenerationProvider>
        </SubscriptionProvider>
        
        <Toaster />
      </Router>
    </AuthProvider>
  );
};

export default App;
