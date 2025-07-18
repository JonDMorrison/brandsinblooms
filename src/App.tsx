import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import CampaignEdit from "@/pages/CampaignEdit";
import Library from "@/pages/Library";
import TemplateLibrary from "@/pages/TemplateLibrary";
import Calendar from "@/pages/Calendar";
import Analytics from "@/pages/Analytics";
import SocialConnections from "@/pages/SocialConnections";
import Account from "@/pages/Account";
import Images from "@/pages/Images";
import Onboarding from "@/pages/Onboarding";
import CRM from "@/pages/crm/CRM";
import CRMCustomers from "@/pages/crm/CRMCustomers";
import CRMCustomerDetail from "@/pages/crm/CRMCustomerDetail";
import CRMSegments from "@/pages/crm/CRMSegments";
import CRMCampaigns from "@/pages/crm/CRMCampaigns";
import CRMCampaignDetail from "@/pages/crm/CRMCampaignDetail";
import CRMCampaignBuilder from "@/pages/crm/CRMCampaignBuilder";
import CRMAnalytics from "@/pages/crm/CRMAnalytics";
import CRMAutomations from "@/pages/crm/CRMAutomations";
import CRMSMSCampaigns from "@/pages/crm/CRMSMSCampaigns";
import CRMIntegrations from "@/pages/crm/CRMIntegrations";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import CRMCampaignCreator from '@/pages/crm/CRMCampaignCreator';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
                <Route path="/campaigns/:campaignId/edit" element={<CampaignEdit />} />
                <Route path="/library" element={<Library />} />
                <Route path="/library/templates" element={<TemplateLibrary />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/social-connections" element={<SocialConnections />} />
                <Route path="/account" element={<Account />} />
                <Route path="/images" element={<Images />} />
                
                {/* CRM Routes */}
                <Route path="/crm" element={<CRM />} />
                <Route path="/crm/customers" element={<CRMCustomers />} />
                <Route path="/crm/customers/:customerId" element={<CRMCustomerDetail />} />
                <Route path="/crm/segments" element={<CRMSegments />} />
                <Route path="/crm/campaigns" element={<CRMCampaigns />} />
                <Route path="/crm/campaigns/new" element={<CRMCampaignCreator />} />
                <Route path="/crm/campaigns/builder/:campaignId" element={<CRMCampaignBuilder />} />
                <Route path="/crm/campaigns/:campaignId" element={<CRMCampaignDetail />} />
                <Route path="/crm/analytics" element={<CRMAnalytics />} />
                <Route path="/crm/automations" element={<CRMAutomations />} />
                <Route path="/crm/sms" element={<CRMSMSCampaigns />} />
                <Route path="/crm/integrations" element={<CRMIntegrations />} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
