import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import NavLayout from '@/components/layout/NavLayout';
import HomePage from '@/pages/HomePage';
import CampaignsPage from '@/pages/CampaignsPage';
import CRMPage from '@/pages/CRMPage';
import SMSPage from '@/pages/SMSPage';
import EmailCampaignsPage from '@/pages/EmailCampaignsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import AssetsPage from '@/pages/AssetsPage';
import SettingsPage from '@/pages/SettingsPage';
import DomainsPage from '@/pages/DomainsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <div className="min-h-screen bg-background text-foreground">
            <div className="flex">
              <NavLayout />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route path="/crm" element={<CRMPage />} />
                  <Route path="/sms" element={<SMSPage />} />
                  <Route path="/crm/campaigns" element={<EmailCampaignsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/domains" element={<DomainsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <Toaster />
          </div>
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
