import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { OnboardingStatusProvider } from "@/contexts/OnboardingStatusContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { GlobalLoadingOverlay } from "@/components/loading/GlobalLoadingOverlay";
import { StartupLoadingManager } from "@/components/loading/StartupLoadingManager";
import { GlobalVisibilityManager } from "@/components/GlobalVisibilityManager";
import { TooltipProvider } from "@/components/ui/tooltip";
// Analytics completely disabled to prevent Firebase/RudderStack errors
import App from "./App.tsx";
import "./index.css";

import "./utils/globalToastReplace";
import { initUptrace } from "@/utils/uptrace";
import { logDevError, logPromiseRejection } from "@/utils/devErrorLogger";

// Initialize Uptrace for frontend monitoring
// initUptrace() // TEMPORARILY DISABLED

// Global error handlers for enhanced debugging visibility
const isDev =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && window.location.hostname === "localhost");

if (isDev) {
  // Catch uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    console.group(
      "%c🔴 [UNCAUGHT ERROR]",
      "color: #ff4444; font-weight: bold; font-size: 14px;",
    );
    console.error("Message:", message);
    console.error("Source:", source);
    console.error("Line:", lineno, "Column:", colno);
    if (error) {
      console.error("Error object:", error);
      console.error("Stack:", error.stack);
      logDevError("runtime", error, {
        functionName: source || "Unknown",
        extra: { line: lineno, column: colno },
      });
    }
    console.groupEnd();
    return false; // Let the error propagate
  };

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    console.group(
      "%c🔴 [UNHANDLED PROMISE REJECTION]",
      "color: #ff4444; font-weight: bold; font-size: 14px;",
    );
    console.error("Reason:", event.reason);
    if (event.reason instanceof Error) {
      console.error("Stack:", event.reason.stack);
    }
    console.groupEnd();
    logPromiseRejection(event.reason);
  };
}

// Create a client with optimized settings for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Reduce retries to fail faster
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 300_000, // 5 minutes default staleTime (increased)
      gcTime: 300_000, // Keep in cache for 5 minutes
      networkMode: "online", // Only run queries when online
    },
    mutations: {
      retry: 1,
      networkMode: "online",
    },
  },
});

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
  </QueryClientProvider>,
);
