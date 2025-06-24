
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Index from "./pages/Index";
import PricingPage from "./pages/PricingPage";
import AccountPage from "./pages/AccountPage";
import CalendarPage from "./pages/CalendarPage";
import BillingPage from "./pages/BillingPage";
import SocialPage from "./pages/SocialPage";
import ContentTasksPage from "./pages/ContentTasksPage";
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
          <Routes>
            <Route
              path="/"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/pricing"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <PricingPage />
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/account"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <AccountPage />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/calendar"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <CalendarPage />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/billing"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <BillingPage />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/social"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <SocialPage />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route
              path="/content-tasks"
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <ProtectedRoute>
                      <ContentTasksPage />
                    </ProtectedRoute>
                  </SubscriptionProvider>
                </AuthProvider>
              }
            />
            <Route 
              path="/auth/callback" 
              element={
                <AuthProvider>
                  <SubscriptionProvider>
                    <AuthCallbackPage />
                  </SubscriptionProvider>
                </AuthProvider>
              } 
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
