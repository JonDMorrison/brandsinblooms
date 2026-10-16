import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
const src = path.resolve(__dirname, "src");
const fixture = path.resolve(__dirname, "e2e/intelligence/fixtures");
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    alias: [
      {
        find: "@/hooks/useTenant",
        replacement: path.join(fixture, "tenant.ts"),
      },
      {
        find: "@/integrations/supabase/client",
        replacement: path.join(fixture, "supabase.ts"),
      },
      ...[
        "@/components/joy/PageContainer",
        "@/components/crm/customer-intelligence/CustomerGrowthWorkspace",
        "@/components/crm/customer-intelligence/LoyaltyProgrammeWorkspace",
        "@/components/crm/customer-intelligence/IdealCustomerTypeExportPanel",
        "@/components/crm/customer-intelligence/PushReadinessPanel",
        "@/components/crm/customer-intelligence/PushPilotPanel",
      ].map((find) => ({ find, replacement: path.join(fixture, "stubs.tsx") })),
      { find: "@", replacement: src },
      {
        find: "react",
        replacement: path.resolve(__dirname, "node_modules/react"),
      },
      {
        find: "react-dom",
        replacement: path.resolve(__dirname, "node_modules/react-dom"),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 4186 },
});
