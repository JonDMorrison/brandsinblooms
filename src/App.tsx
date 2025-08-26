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
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminPage from "@/pages/AdminPage";
import PublishPage from "@/pages/PublishPage";
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
