
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SmartRootRoute } from "@/components/SmartRootRoute";
import PricingPage from "./pages/PricingPage";
import AccountPage from "./pages/AccountPage";
import CalendarPage from "./pages/CalendarPage";
import BillingPage from "./pages/BillingPage";
import SocialPage from "./pages/SocialPage";
import ContentTasksPage from "./pages/ContentTasksPage";
import Auth from "./pages/Auth";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AuthCallbackPage from "./pages/AuthCallbackPage";

// Create a query client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="light" storageKey="ui-theme">
          <AuthProvider>
            <SubscriptionProvider>
              <Routes>
                {/* Smart root route - shows landing page for guests, dashboard for users */}
                <Route path="/" element={<SmartRootRoute />} />
                
                {/* Public auth route */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Public pricing route */}
                <Route path="/pricing" element={<PricingPage />} />
                
                {/* Protected routes */}
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <AccountPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <CalendarPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <ProtectedRoute>
                      <BillingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/social"
                  element={
                    <ProtectedRoute>
                      <SocialPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/content-tasks"
                  element={
                    <ProtectedRoute>
                      <ContentTasksPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
