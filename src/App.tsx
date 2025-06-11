
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DevNavigation } from "@/components/DevNavigation";
import { TrialBanner } from "@/components/TrialBanner";
import { LandingPage } from "@/components/LandingPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PublicRoute } from "@/components/PublicRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import CalendarPage from "./pages/CalendarPage";
import TeamPage from "./pages/TeamPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ContentLibraryPage from "./pages/ContentLibraryPage";
import PricingPage from "./pages/PricingPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <TrialBanner />
              <DevNavigation />
              <Routes>
                {/* Public routes - accessible without authentication */}
                <Route 
                  path="/" 
                  element={
                    <PublicRoute>
                      <LandingPage />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/auth" 
                  element={
                    <PublicRoute>
                      <Auth />
                    </PublicRoute>
                  } 
                />
                <Route 
                  path="/pricing" 
                  element={
                    <PublicRoute>
                      <PricingPage />
                    </PublicRoute>
                  } 
                />
                
                {/* Redirect legacy routes */}
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/signup" element={<Navigate to="/auth" replace />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/get-started" element={<Navigate to="/auth" replace />} />
                
                {/* Redirect removed Kanban route to dashboard */}
                <Route path="/kanban" element={<Navigate to="/app" replace />} />
                
                {/* Protected routes - require authentication */}
                <Route 
                  path="/app" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <Index />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/onboarding" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <OnboardingPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <ProfilePage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/subscription" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <SubscriptionPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/calendar" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <CalendarPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/team" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <TeamPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/analytics" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <AnalyticsPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/content-library" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <ContentLibraryPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <AdminPage />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
