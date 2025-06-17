
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NetworkErrorBoundary } from './components/NetworkErrorBoundary';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { LandingPage } from './components/LandingPage';
import PricingPage from './pages/PricingPage';
import Index from './pages/Index';
import Auth from './pages/Auth';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import CalendarPage from './pages/CalendarPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NetworkErrorBoundary>
          <ErrorBoundary>
            <AuthProvider>
              <SubscriptionProvider>
                <div className="App">
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/app" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/subscription" element={<SubscriptionPage />} />
                    <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
                  </Routes>
                  <Toaster />
                </div>
              </SubscriptionProvider>
            </AuthProvider>
          </ErrorBoundary>
        </NetworkErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
