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
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { DevNavigation } from "@/components/DevNavigation";
import PricingPage from "./pages/PricingPage";
import AccountPage from "./pages/AccountPage";
import ProfilePage from "./pages/ProfilePage";
import CalendarPage from "./pages/CalendarPage";
import BillingPage from "./pages/BillingPage";
import SocialPage from "./pages/SocialPage";
import SocialMediaPage from "./pages/SocialMediaPage";
import ContentTasksPage from "./pages/ContentTasksPage";
import OnboardingPage from "./pages/OnboardingPage";
import AdminPage from "./pages/AdminPage";
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
              <DevNavigation />
              <Routes>
                {/* Smart root route - shows landing page for guests, dashboard for users (with onboarding guard) */}
                <Route 
                  path="/" 
                  element={
                    <OnboardingGuard>
                      <SmartRootRoute />
                    </OnboardingGuard>
                  } 
                />
                
                {/* Redirect /app to / to fix route mismatch */}
                <Route path="/app" element={<Navigate to="/" replace />} />
                
                {/* Onboarding route for new users */}
                <Route 
                  path="/onboarding" 
                  element={
                    <ProtectedRoute>
                      <OnboardingPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Public auth route */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Public pricing route */}
                <Route path="/pricing" element={<PricingPage />} />
                
                {/* Master Admin route - NO OnboardingGuard to allow admin access regardless of onboarding */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Protected routes */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <ProfilePage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <AccountPage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <CalendarPage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <BillingPage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/social"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <SocialPage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/social-media"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <SocialMediaPage />
                      </OnboardingGuard>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/content-tasks"
                  element={
                    <ProtectedRoute>
                      <OnboardingGuard>
                        <ContentTasksPage />
                      </OnboardingGuard>
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
