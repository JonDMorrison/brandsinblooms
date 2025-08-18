import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { NavLayout } from '@/components/layout/NavLayout';
import Index from '@/pages/Index';
import SocialMediaPage from '@/pages/SocialMediaPage';
import { CRMDashboardPage } from '@/pages/crm/CRMDashboardPage';
import SMSTestingDemo from '@/pages/SMSTestingDemo';
import { CRMCampaignsPage } from '@/pages/crm/CRMCampaignsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ContentLibraryPage from '@/pages/ContentLibraryPage';
import SettingsPage from '@/pages/SettingsPage';
import DomainsPage from '@/pages/DomainsPage';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex">
          <NavLayout />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/campaigns" element={<SocialMediaPage />} />
              <Route path="/crm" element={<CRMDashboardPage />} />
              <Route path="/sms" element={<SMSTestingDemo />} />
              <Route path="/crm/campaigns" element={<CRMCampaignsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/assets" element={<ContentLibraryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/domains" element={<DomainsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
