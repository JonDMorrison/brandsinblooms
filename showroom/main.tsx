/**
 * BloomSuite CRM public showroom entry.
 * Same providers and App as src/main.tsx, mounted under /crm with the in-memory
 * Supabase stand-in (see vite.showroom.config.ts). No network access to any backend.
 */
import { installDemoNetworkGuard } from "./networkGuard";
installDemoNetworkGuard();

import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { OnboardingStatusProvider } from "@/contexts/OnboardingStatusContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { TooltipProvider } from "@/components/ui-legacy/tooltip";
import { AIImageStudioProvider } from "@/providers/AIImageStudioProvider";
import { JoyThemeProvider } from "@/providers/JoyThemeProvider";
import App from "@/App.tsx";
import "@/index.css";
import "@/styles/joy-tailwind-bridge.css";
import { ShowroomBar, SHOWROOM_PRODUCTS, resetShowroomOrigin } from "./bar/ShowroomBar";
import "./showroom-layout.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 300_000, gcTime: 300_000, networkMode: "always" },
    mutations: { retry: false, networkMode: "always" },
  },
});

const tips = [
  "Open Customers and search for \"Sarah\" to see a loyalty member's history.",
  "Open Segments to see Houseplant enthusiasts or build your own.",
  "Open Campaigns and edit the Patio Season Kickoff newsletter.",
  "Explore Forms and Automations. Nothing is sent or published.",
];

/** The showroom opens on the CRM dashboard, not the marketing homepage. */
function ShowroomEntry() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/auth" || location.pathname === "/signup") navigate("/dashboard", { replace: true });
  }, [location.pathname, navigate]);
  return null;
}

const products = SHOWROOM_PRODUCTS.map(product => product.id === "crm" ? { ...product, available: true } : product);

createRoot(document.getElementById("root")!).render(
  <JoyThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/crm" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ShowroomBar current="crm" products={products} logoSrc="/crm/favicon.png" tips={tips} onReset={() => { void resetShowroomOrigin(); }} />
        <ShowroomEntry />
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          <LoadingProvider>
            <AuthProvider>
              <AdminProvider>
                <SubscriptionProvider>
                  <OnboardingStatusProvider>
                    <AIImageStudioProvider>
                      <App />
                    </AIImageStudioProvider>
                  </OnboardingStatusProvider>
                </SubscriptionProvider>
              </AdminProvider>
            </AuthProvider>
          </LoadingProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </JoyThemeProvider>,
);
