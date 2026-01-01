import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarLayout } from '@/components/SidebarLayout';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicRoute } from '@/components/PublicRoute';
import { AuthPage } from '@/components/auth/AuthPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ForgotPasswordSentPage } from '@/pages/ForgotPasswordSentPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SmartRootRoute } from '@/components/SmartRootRoute';
import { DataProviderWrapper } from '@/components/DataProviderWrapper';
import { RedirectWithQuery } from '@/components/RedirectWithQuery';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { NavigationTracker } from '@/components/NavigationTracker';
import { CRMCampaignBuilderPage } from '@/pages/CRMCampaignBuilderPage';
import { CRMAutomationBuilderPage } from '@/pages/crm/CRMAutomationBuilderPage';
import { CRMAutomationGuidePage } from '@/pages/crm/CRMAutomationGuidePage';
import { AutomationWizardLandingPage } from '@/pages/crm/AutomationWizardLandingPage';
import OnboardingPage from '@/pages/OnboardingPage';
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
import CRMSegmentsBetaPage from '@/pages/crm/CRMSegmentsBetaPage';
import { CRMPersonasPage } from '@/pages/crm/CRMPersonasPage';
import AddCustomer from '@/pages/crm/AddCustomer';
import { CustomerDetailPage } from '@/pages/crm/CustomerDetailPage';
import CustomerDashboardPage from '@/pages/crm/CustomerDashboardPage';
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
import POSIntegrationsPage from '@/pages/integrations/POSIntegrationsPage';
import CRMIntegrationsPage from '@/pages/integrations/CRMIntegrationsPage';
import SocialIntegrationsPage from '@/pages/integrations/SocialIntegrationsPage';
import AutomationsIntegrationsPage from '@/pages/integrations/AutomationsIntegrationsPage';
import WebsiteIntegrationsPage from '@/pages/integrations/WebsiteIntegrationsPage';
import MigrationsPage from '@/pages/MigrationsPage';
import { OAuthCallbackHandler } from '@/components/migrations/OAuthCallbackHandler';
import ReportedProblemsPage from '@/pages/admin/ReportedProblemsPage';
import ReportedProblemDetailPage from '@/pages/admin/ReportedProblemDetailPage';
import OAuthDebugPage from '@/pages/admin/OAuthDebugPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import CallbackPage from '@/pages/integrations/lightspeed/CallbackPage';
import GuidePage from '@/pages/integrations/lightspeed/GuidePage';
import DebugPage from '@/pages/integrations/lightspeed/DebugPage';
import LightspeedConnectPage from '@/pages/integrations/lightspeed/ConnectPage';
import SquareCallbackPage from '@/pages/integrations/square/CallbackPage';
import SquareGuidePage from '@/pages/integrations/square/GuidePage';
import CloverCallbackPage from '@/pages/integrations/clover/CallbackPage';
import CloverGuidePage from '@/pages/integrations/clover/GuidePage';
import SupportPage from '@/pages/SupportPage';
import PricingPage from '@/pages/PricingPage';
import FAQPage from '@/pages/FAQPage';
import ContactPage from '@/pages/ContactPage';
import PublishPage from '@/pages/PublishPage';
import PlanPage from '@/pages/PlanPage';
import { AboutPage } from '@/pages/AboutPage';
import { FeaturesPage } from '@/pages/FeaturesPage';
import { Home1Page } from '@/pages/Home1Page';
import AdminHub from '@/pages/admin/AdminHub';
import AdminTenants from '@/pages/admin/AdminTenants';
import AdminManage from '@/pages/AdminManage';
import { AdminReportsPage } from '@/pages/AdminReportsPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminCostsPage from '@/pages/admin/AdminCostsPage';
import { CommunityPage } from '@/pages/CommunityPage';
import { SavedBlocksPage } from '@/pages/crm/SavedBlocksPage';
import ConfirmSubscription from '@/pages/ConfirmSubscription';
import CarouselComposerPage from '@/pages/CarouselComposerPage';
import HelpDeskPage from '@/pages/HelpDeskPage';
import TicketListPage from '@/pages/TicketListPage';
import CreateTicketPage from '@/pages/CreateTicketPage';
import TicketDetailPage from '@/pages/TicketDetailPage';
import SeedDemoCustomers from '@/pages/SeedDemoCustomers';
import EmailSendingSettings from '@/pages/crm/EmailSendingSettings';
import UsagePage from '@/pages/UsagePage';
import EmailPreferences from '@/pages/EmailPreferences';
import { ProductsPage, ProductDetailPage } from '@/pages/products';

// Public compliance pages
import { SmsPage } from '@/pages/public/SmsPage';
import { PrivacyPage } from '@/pages/public/PrivacyPage';
import { TermsPage } from '@/pages/public/TermsPage';
import { PlatformAgreementPage } from '@/pages/public/PlatformAgreementPage';
import { TwilioCopyPage } from '@/pages/admin/TwilioCopyPage';


function App() {
  return (
    <HelmetProvider>
      <div className="min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <NavigationTracker />
          <Routes>
          {/* Public routes */}
          <Route path="/auth" element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />
          <Route path="/forgot-password/sent" element={
            <PublicRoute>
              <ForgotPasswordSentPage />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPasswordPage />
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
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          
          {/* Public compliance pages */}
          <Route path="/sms-program" element={<SmsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/platform-agreement" element={<PlatformAgreementPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/home1" element={<Home1Page />} />
          <Route path="/email-preferences" element={<EmailPreferences />} />
          <Route path="/" element={<SmartRootRoute />} />
          
          {/* Protected routes with sidebar */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <SidebarLayout>
                <BloomSuiteDashboard />
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
          <Route path="/crm/customers/:customerId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CustomerDashboardPage />
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
          <Route path="/crm/segments/beta" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMSegmentsBetaPage />
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
                <AutomationWizardLandingPage />
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
          <Route path="/crm/settings/email-sending" element={
            <ProtectedRoute>
              <SidebarLayout>
                <EmailSendingSettings />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/campaigns/blocks" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SavedBlocksPage />
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
          <Route path="/settings/usage" element={
            <ProtectedRoute>
              <SidebarLayout>
                <UsagePage />
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
          <Route path="/integrations/pos" element={
            <ProtectedRoute>
              <SidebarLayout>
                <POSIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/crm" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/social" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SocialIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/automations" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AutomationsIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/website" element={
            <ProtectedRoute>
              <SidebarLayout>
                <WebsiteIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/migrations" element={
            <ProtectedRoute>
              <SidebarLayout>
                <MigrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/oauth/callback" element={<OAuthCallbackHandler />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/integrations/lightspeed/callback" element={<CallbackPage />} />
          <Route path="/integrations/lightspeed/connect" element={
            <ProtectedRoute>
              <SidebarLayout>
                <LightspeedConnectPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/lightspeed/guide" element={
            <ProtectedRoute>
              <SidebarLayout>
                <GuidePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/lightspeed/debug" element={
            <ProtectedRoute>
              <SidebarLayout>
                <DebugPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/square/callback" element={<SquareCallbackPage />} />
          <Route path="/integrations/square/guide" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SquareGuidePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/integrations/clover/callback" element={<CloverCallbackPage />} />
          <Route path="/integrations/clover/guide" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CloverGuidePage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/crm/pos" element={
            <ProtectedRoute>
              <SidebarLayout>
                <POSIntegrationsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          
          {/* Products routes */}
          <Route path="/products" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ProductsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/products/:productId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ProductDetailPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile/*" element={
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
          
          {/* Help Desk Routes */}
          <Route path="/helpdesk" element={
            <ProtectedRoute>
              <SidebarLayout>
                <HelpDeskPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/helpdesk/tickets" element={
            <ProtectedRoute>
              <SidebarLayout>
                <TicketListPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/helpdesk/tickets/new" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CreateTicketPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/helpdesk/tickets/:ticketId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <TicketDetailPage />
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
          <Route path="/carousel/composer" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CarouselComposerPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/plan" element={
            <ProtectedRoute>
              <SidebarLayout>
                <PlanPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminHub />
            </ProtectedRoute>
          } />
          <Route path="/admin/tenants" element={
            <ProtectedRoute>
              <AdminTenants />
            </ProtectedRoute>
          } />
          <Route path="/admin/search" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AdminDashboard />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/manage" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AdminManage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute>
              <SidebarLayout>
                <AdminReportsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/costs" element={
            <ProtectedRoute>
              <AdminCostsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/reported-problems" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ReportedProblemsPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/reported-problems/:problemId" element={
            <ProtectedRoute>
              <SidebarLayout>
                <ReportedProblemDetailPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/oauth-debug" element={
            <ProtectedRoute>
              <SidebarLayout>
                <OAuthDebugPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/seed-demo" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SeedDemoCustomers />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/twilio-copy" element={
            <ProtectedRoute>
              <SidebarLayout>
                <TwilioCopyPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/community" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CommunityPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          
          {/* Public confirmation page */}
          <Route path="/confirm-subscription" element={<ConfirmSubscription />} />
          
          {/* Redirect authenticated users to dashboard, unauthenticated to auth */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
        <ShadcnToaster />
      </ErrorBoundary>
    </div>
    </HelmetProvider>
  );
}

export default App;
