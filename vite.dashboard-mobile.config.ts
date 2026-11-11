import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const fixtures = path.resolve(__dirname, "e2e/dashboard-mobile/fixtures");
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ["e2e/dashboard-mobile/fixture.html"] },
  resolve: {
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    alias: [
      ...[
        "@/contexts/AuthContext",
        "@/contexts/AdminContext",
        "@/contexts/OnboardingStatusContext",
        "@/hooks/useTenant",
        "@/hooks/useUserRole",
      ].map((find) => ({
        find,
        replacement: path.join(fixtures, "session.tsx"),
      })),
      ...[
        "@/components/dashboard/SetupNextStepsBanner",
        "@/components/dashboard/DashboardSetupWizard",
        "@/components/dashboard/QuickStartTour",
        "@/hooks/useTenantAudienceHealth",
        "@/hooks/analytics/useCampaignDeliveryMetrics",
      ].map((find) => ({
        find,
        replacement: path.join(fixtures, "widgets.tsx"),
      })),
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  server: { host: "127.0.0.1", port: 4187 },
});
