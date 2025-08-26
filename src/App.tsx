import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthenticatedLayout } from "@/components/layouts/AuthenticatedLayout";

// Pages
import Index from "@/pages/Index";
import NewDashboard from "@/pages/NewDashboard";
import { CampaignBuilder } from "@/pages/CampaignBuilder";
import CRMDashboard from "@/pages/CRMDashboard";
import CRMCustomers from "@/pages/CRMCustomers";
import CRMSegments from "@/pages/CRMSegments";
import CRMCampaigns from "@/pages/CRMCampaigns";
import CRMAutomations from "@/pages/CRMAutomations";
import { SMSDashboard } from "@/pages/SMSDashboard";
import { SMSCampaigns } from "@/pages/SMSCampaigns";
import { SMSAutomations } from "@/pages/SMSAutomations";
import { SMSMessaging } from "@/pages/SMSMessaging";
import { EmailPage } from "@/pages/EmailPage";
import { WebsitePage } from "@/pages/WebsitePage";
import { AuthPage } from "@/pages/AuthPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { PublishPage } from "@/pages/PublishPage";
import CalendarPage from "@/pages/CalendarPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <Router>
              <Routes>
                {/* Public auth route */}
                <Route path="/auth" element={<AuthPage />} />
                
                {/* All authenticated routes use AppLayout */}
                <Route path="/*" element={
                  <AppLayout>
                    <AuthenticatedLayout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Index />} />
                        <Route path="/new-dashboard" element={<NewDashboard />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/publish" element={<PublishPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        
                        {/* Campaign Builder */}
                        <Route path="/campaign-builder/*" element={<CampaignBuilder />} />
                        
                        {/* CRM Routes */}
                        <Route path="/crm" element={<CRMDashboard />} />
                        <Route path="/crm/customers" element={<CRMCustomers />} />
                        <Route path="/crm/segments" element={<CRMSegments />} />
                        <Route path="/crm/campaigns" element={<CRMCampaigns />} />
                        <Route path="/crm/automations" element={<CRMAutomations />} />
                        
                        {/* SMS Routes */}
                        <Route path="/sms" element={<SMSDashboard />} />
                        <Route path="/sms/campaigns" element={<SMSCampaigns />} />
                        <Route path="/sms/automations" element={<SMSAutomations />} />
                        <Route path="/sms/messaging" element={<SMSMessaging />} />
                        
                        {/* Other Pages */}
                        <Route path="/email" element={<EmailPage />} />
                        <Route path="/website" element={<WebsitePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        
                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </AuthenticatedLayout>
                  </AppLayout>
                } />
              </Routes>
              <Toaster />
            </Router>
          </SubscriptionProvider>
        </AuthProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
