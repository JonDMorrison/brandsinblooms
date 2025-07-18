import { Routes, Route, Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AccountPage from "@/pages/AccountPage";
import AdminPage from "@/pages/AdminPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CRMCampaignCreator from '@/pages/crm/CRMCampaignCreator';

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/account" element={<AccountPage />} />
            
            {/* CRM Routes */}
            <Route path="/crm/campaigns/new" element={<CRMCampaignCreator />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </div>
    </TooltipProvider>
  );
}

export default App;
