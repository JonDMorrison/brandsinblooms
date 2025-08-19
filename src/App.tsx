import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicRoute } from '@/components/PublicRoute';
import { AuthPage } from '@/components/auth/AuthPage';
import { BloomSuiteDashboard } from '@/pages/BloomSuiteDashboard';
import { NewslettersPage } from '@/pages/NewslettersPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { WebsitePage } from '@/pages/WebsitePage';
import Index from '@/pages/Index';
import SocialMediaPage from '@/pages/SocialMediaPage';
import { CRMDashboardPage } from '@/pages/crm/CRMDashboardPage';
import SMSTestingDemo from '@/pages/SMSTestingDemo';
import { CRMCampaignsPage } from '@/pages/crm/CRMCampaignsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ContentLibraryPage from '@/pages/ContentLibraryPage';
import SettingsPage from '@/pages/SettingsPage';
import DomainsPage from '@/pages/DomainsPage';
import CalendarPage from '@/pages/CalendarPage';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          } />
          <Route path="/" element={<Index />} />
          
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
          <Route path="/website" element={
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
                <CalendarPage />
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
          <Route path="/crm/*" element={
            <ProtectedRoute>
              <SidebarLayout>
                <CRMDashboardPage />
              </SidebarLayout>
            </ProtectedRoute>
          } />
          <Route path="/sms" element={
            <ProtectedRoute>
              <SidebarLayout>
                <SMSTestingDemo />
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
          
          {/* Redirect authenticated users to dashboard, unauthenticated to auth */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
