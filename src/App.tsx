
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Homepage } from '@/components/Homepage';
import { CompleteLandingPage } from '@/components/landing/CompleteLandingPage';
import OnboardingPage from '@/pages/OnboardingPage';
import CalendarPage from '@/pages/CalendarPage';
import PublishPage from '@/pages/PublishPage';
import { CRMCampaignCreatorPage } from '@/pages/CRMCampaignCreatorPage';
import { CRMCampaignBuilderPage } from '@/pages/CRMCampaignBuilderPage';
import { CRMDashboardPage } from '@/pages/crm/CRMDashboardPage';
import { CRMCustomersPage } from '@/pages/crm/CRMCustomersPage';
import { CRMSegmentsPage } from '@/pages/crm/CRMSegmentsPage';
import { CRMPersonaAnalyticsPage } from '@/pages/crm/CRMPersonaAnalyticsPage';
import { CRMAnalyticsPage } from '@/pages/crm/CRMAnalyticsPage';
import { CRMCampaignsPage } from '@/pages/crm/CRMCampaignsPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ContentGenerationProvider } from '@/contexts/ContentGenerationContext';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
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
        <Route path="/crm/segments" element={
          <ProtectedRoute>
            <SidebarLayout>
              <CRMSegmentsPage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      <Analytics />
    </div>
  );
}

export default App;
