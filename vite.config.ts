import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "process.env.VITE_ENABLE_SENTINEL": JSON.stringify(
      process.env.VITE_ENABLE_SENTINEL || "false",
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/@mui/") ||
            id.includes("/node_modules/@emotion/")
          ) {
            return "vendor-joy";
          }

          if (id.includes("/node_modules/recharts/")) {
            return "vendor-recharts";
          }

          if (id.includes("/node_modules/")) {
            return "vendor";
          }

          return undefined;
        },
      },
    },
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "@mui/joy/LinearProgress",
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
}));
