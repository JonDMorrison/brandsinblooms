
import { Routes, Route, Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { SmartRootRoute } from "@/components/SmartRootRoute";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AccountPage from "@/pages/AccountPage";
import AdminPage from "@/pages/AdminPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SidebarLayout } from "@/components/SidebarLayout";
import { CRMCampaignCreator } from '@/pages/crm/CRMCampaignCreator';
import CRMAnalytics from '@/pages/crm/CRMAnalytics';
import CRMDashboard from '@/pages/crm/CRMDashboard';
import CRMCustomers from '@/pages/crm/CRMCustomers';
import CRMSegments from '@/pages/crm/CRMSegments';
import PersonaAnalytics from '@/pages/crm/PersonaAnalytics';

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<SmartRootRoute />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected Routes with Sidebar Layout */}
          <Route element={
            <ProtectedRoute>
              <SidebarLayout>
                <Outlet />
              </SidebarLayout>
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Index />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/account" element={<AccountPage />} />
            
            {/* CRM Routes */}
            <Route path="/crm" element={<CRMDashboard />} />
            <Route path="/crm/customers" element={<CRMCustomers />} />
            <Route path="/crm/segments" element={<CRMSegments />} />
            <Route path="/crm/personas/analytics" element={<PersonaAnalytics />} />
            <Route path="/crm/campaigns/new" element={<CRMCampaignCreator />} />
            <Route path="/crm/analytics" element={<CRMAnalytics />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </div>
    </TooltipProvider>
  );
}

export default App;
