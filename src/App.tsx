
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ContentGenerationProvider } from "./contexts/ContentGenerationContext";
import { DashboardProvider } from "./context/DashboardContext";
import { NetworkErrorBoundary } from "./components/NetworkErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import OnboardingPage from "./pages/OnboardingPage";
import AdminPage from "./pages/AdminPage";
import AccountPage from "./pages/AccountPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import CalendarPage from "./pages/CalendarPage";
import ContentTasksPage from "./pages/ContentTasksPage";
import ContentLibraryPage from "./pages/ContentLibraryPage";
import SocialMediaPage from "./pages/SocialMediaPage";
import SocialPage from "./pages/SocialPage";
import DevSocialPage from "./pages/DevSocialPage";
import PublishPage from "./pages/PublishPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BillingPage from "./pages/BillingPage";
import ProfilePage from "./pages/ProfilePage";
import TeamPage from "./pages/TeamPage";
import TestPage from "./pages/TestPage";
import NotFound from "./pages/NotFound";
import PricingPage from "./pages/PricingPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import UserDataDeletionPage from "./pages/UserDataDeletionPage";
import DashboardSocial from "./pages/DashboardSocial";
import NewDashboard from "./pages/NewDashboard";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NetworkErrorBoundary>
          <BrowserRouter>
            <SubscriptionProvider>
              <ContentGenerationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/subscription" element={<SubscriptionPage />} />
                    <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/content-tasks" element={<ContentTasksPage />} />
                    <Route path="/content-library" element={<ContentLibraryPage />} />
                    <Route path="/social" element={<SocialMediaPage />} />
                    <Route path="/social-page" element={<SocialPage />} />
                    <Route path="/dev-social" element={<DevSocialPage />} />
                    <Route path="/publish" element={<PublishPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/team" element={<TeamPage />} />
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/blog" element={<BlogPage />} />
                    <Route path="/blog/:slug" element={<BlogPostPage />} />
                    <Route path="/user-data-deletion" element={<UserDataDeletionPage />} />
                    <Route path="/dashboard-social" element={<DashboardSocial />} />
                    <Route 
                      path="/new-dashboard" 
                      element={
                        <DashboardProvider>
                          <NewDashboard />
                        </DashboardProvider>
                      } 
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </TooltipProvider>
              </ContentGenerationProvider>
            </SubscriptionProvider>
          </BrowserRouter>
        </NetworkErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
