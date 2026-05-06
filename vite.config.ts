import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const getNodeModulePackageName = (id: string) => {
  const match = id.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);

  return match?.[1] ?? null;
};

const toVendorChunkName = (packageName: string) =>
  `vendor-${packageName.replace(/^@/, "").replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

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
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-runtime.js",
      ),
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-dev-runtime.js",
      ),
      "@emotion/react": path.resolve(
        __dirname,
        "./node_modules/@emotion/react",
      ),
      "@emotion/styled": path.resolve(
        __dirname,
        "./node_modules/@emotion/styled",
      ),
      "@emotion/cache": path.resolve(
        __dirname,
        "./node_modules/@emotion/cache",
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const packageName = getNodeModulePackageName(id);

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
            return packageName ? toVendorChunkName(packageName) : "vendor-misc";
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
      "@emotion/react",
      "@emotion/styled",
      "@emotion/cache",
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
