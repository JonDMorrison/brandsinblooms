import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NetworkErrorBoundary } from './components/NetworkErrorBoundary';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { LandingPage } from './components/LandingPage';
import { SidebarLayout } from './components/SidebarLayout';
import { Homepage } from './components/Homepage';
import { DashboardContent } from './components/dashboard/DashboardContent';
import PricingPage from './pages/PricingPage';
import Index from './pages/Index';
import Auth from './pages/Auth';
import OnboardingPage from './pages/OnboardingPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import CalendarPage from './pages/CalendarPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import TeamPage from './pages/TeamPage';
import AdminPage from './pages/AdminPage';

// Create QueryClient instance outside of component to avoid recreation
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
    <ErrorBoundary>
      <NetworkErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <BrowserRouter>
              <AuthProvider>
                <SubscriptionProvider>
                  <div className="App">
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/onboarding" element={<OnboardingPage />} />
                      <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      
                      {/* Main app route now uses DashboardContent directly */}
                      <Route path="/app" element={
                        <DashboardContent
                          onboardingData={{
                            aboutBusiness: "",
                            toneSamples: "",
                            annualEvents: "",
                            websiteUrl: ""
                          }}
                          onBusinessNameChange={() => {}}
                          onCampaignCreated={() => {}}
                        />
                      } />
                      
                      {/* Keep Homepage available for legacy routes */}
                      <Route path="/homepage" element={<Homepage />} />
                      
                      {/* Other dashboard routes use SidebarLayout */}
                      <Route path="/dashboard" element={
                        <SidebarLayout>
                          <Index />
                        </SidebarLayout>
                      } />
                      <Route path="/home" element={
                        <SidebarLayout>
                          <Index />
                        </SidebarLayout>
                      } />
                      <Route path="/calendar" element={
                        <SidebarLayout>
                          <CalendarPage />
                        </SidebarLayout>
                      } />
                      <Route path="/analytics" element={
                        <SidebarLayout>
                          <AnalyticsPage />
                        </SidebarLayout>
                      } />
                      <Route path="/profile" element={
                        <SidebarLayout>
                          <ProfilePage />
                        </SidebarLayout>
                      } />
                      <Route path="/team" element={
                        <SidebarLayout>
                          <TeamPage />
                        </SidebarLayout>
                      } />
                      <Route path="/subscription" element={
                        <SidebarLayout>
                          <SubscriptionPage />
                        </SidebarLayout>
                      } />
                    </Routes>
                    <Toaster />
                  </div>
                </SubscriptionProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </NetworkErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
