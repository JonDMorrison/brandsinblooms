
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Homepage } from '@/components/Homepage';
import Auth from '@/pages/Auth';
import OnboardingPage from '@/pages/OnboardingPage';
import CalendarPage from '@/pages/CalendarPage';
import PublishPage from '@/pages/PublishPage';
import ProfilePage from '@/pages/ProfilePage';
import SocialMediaPage from '@/pages/SocialMediaPage';
import SuccessPage from '@/pages/SuccessPage';
import IntegrationsPage from '@/pages/IntegrationsPage';
import AutomationPage from '@/pages/AutomationPage';
import AccountPage from '@/pages/AccountPage';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { CRMCampaignBuilderPage } from '@/pages/CRMCampaignBuilderPage';
import { CRMDashboardPage } from '@/pages/crm/CRMDashboardPage';
import CRMCustomers from '@/pages/crm/CRMCustomers';
import AddCustomer from '@/pages/crm/AddCustomer';
import { CRMSegmentsPage } from '@/pages/crm/CRMSegmentsPage';
import { CRMPersonasPage } from '@/pages/crm/CRMPersonasPage';
import { CRMPersonaAnalyticsPage } from '@/pages/crm/CRMPersonaAnalyticsPage';
import { CRMAnalyticsPage } from '@/pages/crm/CRMAnalyticsPage';
import { CRMCampaignsPage } from '@/pages/crm/CRMCampaignsPage';
import CRMAutomations from '@/pages/crm/CRMAutomations';
import { CRMAutomationGuidePage } from '@/pages/crm/CRMAutomationGuidePage';
import { CRMAutomationCanvasPage } from '@/pages/crm/CRMAutomationCanvasPage';
import Customer360Page from '@/pages/crm/Customer360Page';
import SegmentBuilderPage from '@/pages/crm/SegmentBuilderPage';
import { BloomSuiteDashboard } from '@/pages/BloomSuiteDashboard';
import { NewsletterNewPage } from '@/pages/NewsletterNewPage';
import { WebsiteWaitlistPage } from '@/pages/WebsiteWaitlistPage';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';
import SMSRoutes from '@/routes/SMSRoutes';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SidebarLayout } from '@/components/SidebarLayout';
import ContentLibraryPage from '@/pages/ContentLibraryPage';
import { ContentGenerationProvider } from '@/contexts/ContentGenerationContext';
import { Analytics } from '@vercel/analytics/react';
import { OverlayManager } from '@/providers/OverlayManager';
import { QuickTourProvider } from '@/contexts/QuickTourContext';
import { TourManager } from '@/components/tour/TourManager';
import POSPage from '@/pages/settings/POSPage';
import SettingsPage from '@/pages/SettingsPage';

// Emergency cleanup - remove any stray inert attributes
import '@/utils/emergency-cleanup';

function App() {
  return (
    <OverlayManager>
      <QuickTourProvider>
        <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <SidebarLayout>
              <BloomSuiteDashboard />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/legacy" element={
          <ProtectedRoute>
            <SidebarLayout>
              <ContentGenerationProvider>
                <Homepage />
              </ContentGenerationProvider>
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CalendarPage />
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
<Route path="/content/library" element={
  <ProtectedRoute>
    <SidebarLayout>
      <ContentLibraryPage />
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
              <CRMCustomers />
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
        <Route path="/crm/customers/:id" element={
          <ProtectedRoute>
            <SidebarLayout>
              <Customer360Page />
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
        <Route path="/crm/segments/new" element={
          <ProtectedRoute>
            <SidebarLayout>
              <SegmentBuilderPage />
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
        <Route path="/crm/personas/analytics" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMPersonaAnalyticsPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/analytics" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMAnalyticsPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <SidebarLayout>
              <AnalyticsDashboard />
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
        <Route path="/crm/campaigns/:campaignId" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMCampaignBuilderPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/campaigns/new/:campaignSlug" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMCampaignBuilderPage />
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
        <Route path="/crm/automations" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMAutomations />
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
              <CRMAutomationCanvasPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/automations/:id/canvas" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMAutomationCanvasPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/crm/automations/new" element={<Navigate to="/crm/automations/new/guide" replace />} />
        <Route path="/crm/automations/:id" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMAutomationCanvasPage />
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
        <Route path="/newsletters/new" element={
          <ProtectedRoute>
            <SidebarLayout>
              <NewsletterNewPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/website" element={
          <ProtectedRoute>
            <WebsiteWaitlistPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <SidebarLayout>
              <ProfilePage />
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
        <Route path="/success" element={
          <ProtectedRoute>
            <SidebarLayout>
              <SuccessPage />
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
        <Route path="/automation" element={
          <ProtectedRoute>
            <SidebarLayout>
              <AutomationPage />
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
        <Route path="/account" element={
          <ProtectedRoute>
            <SidebarLayout>
              <AccountPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="/settings/pos" element={
          <ProtectedRoute>
            <SidebarLayout>
              <POSPage />
            </SidebarLayout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        <TourManager />
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
        </div>
      </QuickTourProvider>
    </OverlayManager>
  );
}

export default App;
