
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
import { LoadingProvider } from './contexts/LoadingContext';
import { GlobalDataProvider } from './contexts/GlobalDataContext';
import { LazyLoadWrapper } from './components/LazyLoadWrapper';
import { optimizeImageLoading } from './utils/performanceOptimizations';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AuthenticatedLayout } from './components/layouts/AuthenticatedLayout';
import { GlobalLoadingOverlay } from './components/loading/GlobalLoadingOverlay';

// Immediate loading for critical components
import { SmartRootRoute } from './components/SmartRootRoute';
import Auth from "./pages/Auth";


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

// CRM Pages
const CRMDashboard = lazy(() => import("./pages/crm/CRMDashboard"));
const CRMCustomers = lazy(() => import("./pages/crm/CRMCustomers"));
const CRMSegments = lazy(() => import("./pages/crm/CRMSegments"));
const CRMCampaigns = lazy(() => import("./pages/crm/CRMCampaigns"));

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
      <LoadingProvider>
        <GlobalDataProvider>
          <Router>
            <SubscriptionProvider>
              <ContentGenerationProvider>
                <SidebarProvider>
                <GlobalLoadingOverlay />
                <Routes>
                {/* Critical routes - no lazy loading */}
                <Route path="/" element={<SmartRootRoute />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/social" element={<Navigate to="/social-accounts" replace />} />
                
                {/* Authenticated routes with shared layout */}
                <Route path="/new-dashboard" element={
                  <AuthenticatedLayout>
                    <LazyLoadWrapper>
                      <NewDashboard />
                    </LazyLoadWrapper>
                  </AuthenticatedLayout>
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
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <AccountSettings />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/profile" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CompanyProfile />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/company-profile" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CompanyProfile />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/social-accounts" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <SocialAccounts />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/billing" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <BillingPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/calendar" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CalendarPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/team" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <TeamPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/content-import" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <ContentImportPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/review-queue" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <ReviewQueuePage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/dev-social" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <DevSocialPageWrapper />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
                <Route path="/publish" element={
                  <AuthenticatedLayout>
                    <LazyLoadWrapper loadingText="Loading publish portal...">
                      <PublishPage />
                    </LazyLoadWrapper>
                  </AuthenticatedLayout>
                } />
              <Route path="/success" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <SuccessPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/integrations" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <IntegrationsPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/integrations/zapier" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <ZapierPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/automation" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <AutomationPage />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/crm" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CRMDashboard />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/crm/customers" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CRMCustomers />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/crm/segments" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CRMSegments />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
              } />
              <Route path="/crm/campaigns" element={
                <AuthenticatedLayout>
                  <LazyLoadWrapper>
                    <CRMCampaigns />
                  </LazyLoadWrapper>
                </AuthenticatedLayout>
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
                </SidebarProvider>
              </ContentGenerationProvider>
            </SubscriptionProvider>
            
            
          </Router>
        </GlobalDataProvider>
      </LoadingProvider>
    </AuthProvider>
  );
};

export default App;
