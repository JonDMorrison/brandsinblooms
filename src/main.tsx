
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { GlobalLoadingOverlay } from '@/components/loading/GlobalLoadingOverlay'
import App from './App.tsx'
import './index.css'
import './utils/globalToastReplace'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <LoadingProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <App />
            <GlobalLoadingOverlay />
          </SubscriptionProvider>
        </AuthProvider>
      </LoadingProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
