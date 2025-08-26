import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicRoute } from '@/components/PublicRoute';
import { AuthPage } from '@/components/auth/AuthPage';
import { SmartRootRoute } from '@/components/SmartRootRoute';
import { DataProviderWrapper } from '@/components/DataProviderWrapper';
import { RedirectWithQuery } from '@/components/RedirectWithQuery';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { CRMCampaignBuilderPage } from '@/pages/CRMCampaignBuilderPage';
import { CRMAutomationBuilderPage } from '@/pages/crm/CRMAutomationBuilderPage';
import { CRMAutomationGuidePage } from '@/pages/crm/CRMAutomationGuidePage';
import OnboardingPage from '@/pages/OnboardingPage'; // Force refresh
import { BloomSuiteDashboard } from '@/pages/BloomSuiteDashboard';
import { NewslettersPage } from '@/pages/NewslettersPage';
import { NewsletterNewPage } from '@/pages/NewsletterNewPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { WebsitePage } from '@/pages/WebsitePage';
import { WebsiteWaitlistPage } from '@/pages/WebsiteWaitlistPage';
import Index from '@/pages/Index';
import SocialMediaPage from '@/pages/SocialMediaPage';
import { CRMDashboardPage } from '@/pages/crm/CRMDashboardPage';
import SMSTestingDemo from '@/pages/SMSTestingDemo';
import SMSRoutes from '@/routes/SMSRoutes';
import { CRMCampaignsPage } from '@/pages/crm/CRMCampaignsPage';
import { CRMCustomersPage } from '@/pages/crm/CRMCustomersPage';
import { CRMSegmentsPage } from '@/pages/crm/CRMSegmentsPage';
import { CRMPersonasPage } from '@/pages/crm/CRMPersonasPage';
import AddCustomer from '@/pages/crm/AddCustomer';
import CRMAnalytics from '@/pages/crm/CRMAnalytics';
import CRMAutomations from '@/pages/crm/CRMAutomations';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ContentLibraryPage from '@/pages/ContentLibraryPage';
import SettingsPage from '@/pages/SettingsPage';
import DomainsPage from '@/pages/DomainsPage';
import CalendarPage from '@/pages/CalendarPage';
import AccountPage from '@/pages/AccountPage';
import ProfilePage from '@/pages/ProfilePage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import SupportPage from '@/pages/SupportPage';
import PricingPage from '@/pages/PricingPage';
import PublishPage from '@/pages/PublishPage';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          } />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/manual" element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/" element={<SmartRootRoute />} />
          
          {/* Protected routes with sidebar */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <SidebarLayout>
                <DataProviderWrapper>
                  <BloomSuiteDashboard />
                </DataProviderWrapper>
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/newsletters" element={
            <ProtectedRoute>
              <SidebarLayout>
                <NewslettersPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/templates" element={
            <ProtectedRoute>
              <SidebarLayout>
                <TemplatesPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          {/* Public website landing page */}
          <Route path="/website" element={<WebsiteWaitlistPage />} />
          <Route path="/website/waitlist" element={<WebsiteWaitlistPage />} />
          {/* Protected website builder */}
          <Route path="/website/app" element={
            <ProtectedRoute>
              <SidebarLayout>
                <WebsitePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/content" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ContentLibraryPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/content/library" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ContentLibraryPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <SidebarLayout>
                <DataProviderWrapper>
                  <CalendarPage />
                </DataProviderWrapper>
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/campaigns" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SocialMediaPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMDashboardPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/customers" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMCustomersPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/customers/new" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AddCustomer />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/campaigns" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMCampaignsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/segments" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMSegmentsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/personas" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMPersonasPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/analytics" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAnalytics />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/automations" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAutomations />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/automations/new" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAutomationGuidePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/automations/new/guide" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAutomationGuidePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/automations/new/canvas" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAutomationBuilderPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/automations/:automationId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMAutomationBuilderPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/campaigns/new" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMCampaignCreatorPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/campaigns/:campaignId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMCampaignBuilderPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/sms/*" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SMSRoutes />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/sms/test" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SMSTestingDemo />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AnalyticsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/assets" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ContentLibraryPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SettingsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/domains" element={
            <ProtectedRoute>
              <SidebarLayout>
                <DomainsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/social-accounts" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SocialMediaPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/newsletters/new" element={
            <ProtectedRoute>
              <SidebarLayout>
                <NewsletterNewPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/newsletters/builder" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMCampaignCreatorPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations" element={
            <ProtectedRoute>
              <SidebarLayout>
                <IntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ProfilePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/account" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AccountPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/support" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SupportPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/publish" element={
            <ProtectedRoute>
              <SidebarLayout>
                <PublishPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          
          {/* Redirect authenticated users to dashboard, unauthenticated to auth */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </div>
  );
}

export default App;
