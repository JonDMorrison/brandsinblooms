import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ui/theme-provider";
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
import { Auth } from "@supabase/auth-ui-react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NetworkErrorBoundary } from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from "./components/ErrorFallback";
import AuthCallbackPage from "./pages/AuthCallbackPage";

function App() {
  return (
    <QueryClient>
      <BrowserRouter>
        <ThemeProvider defaultTheme="light" storageKey="ui-theme">
          <ErrorBoundary>
            <NetworkErrorBoundary>
              <Routes>
                <Route
                  path="/auth"
                  element={
                    <AuthProvider>
                      <SubscriptionProvider>
                        <Auth
                          supabaseClient={useSupabaseClient()}
                          appearance={{ theme: ThemeProvider.defaultProps.defaultTheme }}
                          providers={['google', 'facebook']}
                          redirectTo={`${window.location.origin}/`}
                        />
                      </SubscriptionProvider>
                    </AuthProvider>
                  }
                />
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
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </NetworkErrorBoundary>
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClient>
  );
}

export default App;
