
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { SidebarLayout } from "@/components/SidebarLayout";
import { NetworkErrorBoundary } from "@/components/NetworkErrorBoundary";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OnboardingPage from "./pages/OnboardingPage";
import CalendarPage from "./pages/CalendarPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ContentLibraryPage from "./pages/ContentLibraryPage";
import ProfilePage from "./pages/ProfilePage";
import TeamPage from "./pages/TeamPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import PricingPage from "./pages/PricingPage";
import AdminPage from "./pages/AdminPage";
import SocialPage from "./pages/SocialPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <NetworkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TooltipProvider>
              <AuthProvider>
                <BrowserRouter>
                  <SubscriptionProvider>
                    <Toaster />
                    <Routes>
                      {/* Public routes */}
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/auth" element={
                        <PublicRoute>
                          <Auth />
                        </PublicRoute>
                      } />
                      <Route path="/auth/callback" element={<AuthCallbackPage />} />
                      <Route path="/subscription-success" element={<SubscriptionSuccessPage />} />
                      
                      {/* Protected routes */}
                      <Route path="/onboarding" element={
                        <ProtectedRoute>
                          <OnboardingPage />
                        </ProtectedRoute>
                      } />
                      
                      {/* Main app routes (require onboarding completion) */}
                      <Route path="/" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <Index />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/calendar" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <CalendarPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/analytics" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <AnalyticsPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/content-library" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <ContentLibraryPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <ProfilePage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/team" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <TeamPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/subscription" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <SubscriptionPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/social" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <SocialPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="/admin" element={
                        <ProtectedRoute>
                          <OnboardingGuard>
                            <SidebarLayout>
                              <AdminPage />
                            </SidebarLayout>
                          </OnboardingGuard>
                        </ProtectedRoute>
                      } />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SubscriptionProvider>
                </BrowserRouter>
              </AuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
