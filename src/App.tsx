
import React, { lazy } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ContentGenerationProvider } from './contexts/ContentGenerationContext';
import { LazyLoadWrapper } from './components/LazyLoadWrapper';
import { optimizeImageLoading } from './utils/performanceOptimizations';

// Immediate loading for critical components
import { SmartRootRoute } from './components/SmartRootRoute';
import Auth from "./pages/Auth";
import { Toaster } from './components/ui/sonner';

// Lazy load non-critical components for better initial performance
const NewDashboard = lazy(() => import('./pages/NewDashboard'));
const Onboarding = lazy(() => import('./pages/OnboardingPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const AccountSettings = lazy(() => import('./pages/AccountPage'));
const CompanyProfile = lazy(() => import('./pages/ProfilePage'));
const SocialAccounts = lazy(() => import('./pages/SocialPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const ContentImportPage = lazy(() => import('./pages/ContentLibraryPage'));
const ReviewQueuePage = lazy(() => import('./pages/ContentTasksPage'));
const DevSocialPageWrapper = lazy(() => import('./pages/DevSocialPage'));
const PublishPage = lazy(() => import("./pages/PublishPage"));
const SuccessPage = lazy(() => import("./pages/SuccessPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const ZapierPage = lazy(() => import("./pages/ZapierPage"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));

// Lazy load test components
const SocialMediaIntegrationTest = lazy(() => import('./components/test/SocialMediaIntegrationTest').then(module => ({ default: module.SocialMediaIntegrationTest })));
const OAuthDebugger = lazy(() => import('./components/test/OAuthDebugger').then(module => ({ default: module.OAuthDebugger })));

const App = () => {
  // Initialize image optimization when app loads
  React.useEffect(() => {
    optimizeImageLoading();
  }, []);
  return (
    <AuthProvider>
      <Router>
        <SubscriptionProvider>
          <ContentGenerationProvider>
            <Routes>
              {/* Critical routes - no lazy loading */}
              <Route path="/" element={<SmartRootRoute />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/social" element={<Navigate to="/social-accounts" replace />} />
              
              {/* Lazy loaded routes */}
              <Route path="/new-dashboard" element={
                <LazyLoadWrapper>
                  <NewDashboard />
                </LazyLoadWrapper>
              } />
              <Route path="/auth/callback" element={
                <LazyLoadWrapper>
                  <AuthCallbackPage />
                </LazyLoadWrapper>
              } />
              <Route path="/auth/test" element={<div style={{padding: '20px', fontSize: '24px', color: 'green'}}>🧪 Auth Test Route Working! URL: {window.location.href}</div>} />
              <Route path="/onboarding" element={
                <LazyLoadWrapper>
                  <Onboarding />
                </LazyLoadWrapper>
              } />
              <Route path="/onboarding/manual" element={
                <LazyLoadWrapper>
                  <Onboarding />
                </LazyLoadWrapper>
              } />
              <Route path="/pricing" element={
                <LazyLoadWrapper>
                  <PricingPage />
                </LazyLoadWrapper>
              } />
              <Route path="/account" element={
                <LazyLoadWrapper>
                  <AccountSettings />
                </LazyLoadWrapper>
              } />
              <Route path="/profile" element={
                <LazyLoadWrapper>
                  <CompanyProfile />
                </LazyLoadWrapper>
              } />
              <Route path="/company-profile" element={
                <LazyLoadWrapper>
                  <CompanyProfile />
                </LazyLoadWrapper>
              } />
              <Route path="/social-accounts" element={
                <LazyLoadWrapper>
                  <SocialAccounts />
                </LazyLoadWrapper>
              } />
              <Route path="/billing" element={
                <LazyLoadWrapper>
                  <BillingPage />
                </LazyLoadWrapper>
              } />
              <Route path="/calendar" element={
                <LazyLoadWrapper>
                  <CalendarPage />
                </LazyLoadWrapper>
              } />
              <Route path="/team" element={
                <LazyLoadWrapper>
                  <TeamPage />
                </LazyLoadWrapper>
              } />
              <Route path="/content-import" element={
                <LazyLoadWrapper>
                  <ContentImportPage />
                </LazyLoadWrapper>
              } />
              <Route path="/review-queue" element={
                <LazyLoadWrapper>
                  <ReviewQueuePage />
                </LazyLoadWrapper>
              } />
              <Route path="/dev-social" element={
                <LazyLoadWrapper>
                  <DevSocialPageWrapper />
                </LazyLoadWrapper>
              } />
              <Route path="/publish" element={
                <LazyLoadWrapper>
                  <PublishPage />
                </LazyLoadWrapper>
              } />
              <Route path="/success" element={
                <LazyLoadWrapper>
                  <SuccessPage />
                </LazyLoadWrapper>
              } />
              <Route path="/integrations" element={
                <LazyLoadWrapper>
                  <IntegrationsPage />
                </LazyLoadWrapper>
              } />
              <Route path="/integrations/zapier" element={
                <LazyLoadWrapper>
                  <ZapierPage />
                </LazyLoadWrapper>
              } />
              <Route path="/automation" element={
                <LazyLoadWrapper>
                  <AutomationPage />
                </LazyLoadWrapper>
              } />
              <Route path="/test/social-integration" element={
                <LazyLoadWrapper>
                  <div className="container mx-auto p-8">
                    <SocialMediaIntegrationTest />
                  </div>
                </LazyLoadWrapper>
              } />
              <Route path="/test/oauth-debug" element={
                <LazyLoadWrapper>
                  <div className="container mx-auto p-8">
                    <OAuthDebugger />
                  </div>
                </LazyLoadWrapper>
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
