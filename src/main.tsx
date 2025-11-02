import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { OnboardingStatusProvider } from '@/contexts/OnboardingStatusContext'
import { AdminProvider } from '@/contexts/AdminContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { GlobalLoadingOverlay } from '@/components/loading/GlobalLoadingOverlay'
import { StartupLoadingManager } from '@/components/loading/StartupLoadingManager'
import { GlobalVisibilityManager } from '@/components/GlobalVisibilityManager'
import { TooltipProvider } from '@/components/ui/tooltip'
// Analytics completely disabled to prevent Firebase/RudderStack errors
import App from './App.tsx'
import './index.css'

import './utils/globalToastReplace'
import { initUptrace } from '@/utils/uptrace'

// Initialize Uptrace for frontend monitoring
initUptrace()


// Create a client with optimized settings for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Reduce retries to fail faster
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 300_000, // 5 minutes default staleTime (increased)
      gcTime: 300_000, // Keep in cache for 5 minutes
      networkMode: 'online', // Only run queries when online
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider delayDuration={300} skipDelayDuration={100}>
        <LoadingProvider>
          <AuthProvider>
            <AdminProvider>
              <SubscriptionProvider>
                <OnboardingStatusProvider>
                  <App />
                  <GlobalLoadingOverlay />
                  <StartupLoadingManager />
                  <GlobalVisibilityManager />
                </OnboardingStatusProvider>
              </SubscriptionProvider>
            </AdminProvider>
          </AuthProvider>
        </LoadingProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
