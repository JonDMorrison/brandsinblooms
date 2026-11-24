import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

/**
 * Public CRM showroom build. The real CRM app, with every Supabase entry point replaced by
 * an in-memory stand-in (showroom/fake). The output contains no backend URL or key.
 */
const showroom = path.resolve(__dirname, "showroom");
// Showroom feature switches. Vite reads VITE_* values from the process environment.
process.env.VITE_CARE_GUIDE_STUDIO_ENABLED = "true";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "showroom-no-key";
export default defineConfig({
  root: showroom,
  base: "/crm/",
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("showroom-no-key"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://showroom.invalid"),
  },
  resolve: {
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    alias: [
      { find: /^@\/integrations\/supabase\/client$/, replacement: path.join(showroom, "fake/client.ts") },
      { find: /^@\/integrations\/supabase\/config$/, replacement: path.join(showroom, "fake/config.ts") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  // Files live under /crm so the site can sit behind demo.bloomsuite.app/crm/ unchanged.
  build: { outDir: path.join(showroom, "dist/crm"), emptyOutDir: true, sourcemap: false },
  server: { host: "127.0.0.1", port: 4195 },
});
