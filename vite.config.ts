import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const resolveWatchPolling = () => {
  const envValue = process.env.CHOKIDAR_USEPOLLING;

  if (envValue == null) {
    return true;
  }

  return !["0", "false"].includes(envValue.toLowerCase());
};

const resolveWatchInterval = () => {
  const interval = Number.parseInt(process.env.CHOKIDAR_INTERVAL ?? "150", 10);

  return Number.isNaN(interval) ? 150 : interval;
};

/**
 * The capped CPU count, or `null` when running uncapped.
 *
 * `run-capped.sh` (shared with the CMS, at
 * `../cms-brandsinblooms/scripts/run-capped.sh`) exports `CAP_CPUS` and nothing
 * else sets it, so an absent or malformed value means "no cap in force" and
 * every consumer falls back to the Vite default. That is what keeps the plain
 * `dev` script exactly as it was.
 */
const cappedCpuCount = () => {
  const raw = Number.parseInt(process.env.CAP_CPUS ?? "", 10);

  return Number.isInteger(raw) && raw > 0 ? raw : null;
};

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
    watch: {
      // Polling avoids ENOSPC failures on large Linux workspaces with low inotify limits.
      usePolling: resolveWatchPolling(),
      interval: resolveWatchInterval(),
      ignored: [
        // node_modules first, and it matters most here: this watcher runs with
        // `usePolling` on by default, so without it every poll interval walks a
        // tree of tens of thousands of files that can never change a build.
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "**/e2e/.auth/**",
        "**/e2e/reports/**",
        "**/supabase/.temp/**",
      ],
    },
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
      /*
        The one parallelism knob Vite exposes. Rollup's default is 20 concurrent
        file operations regardless of the machine; under a 2-CPU cage that is
        twenty operations queueing for two CPUs.

        Vite's DEV server exposes no equivalent — its heavy subprocess is
        esbuild, whose Go runtime is bounded by `GOMAXPROCS`, which the runner
        exports. Absent CAP_CPUS this spreads to `{}` and Rollup keeps its own
        default.
      */
      ...(cappedCpuCount() ? { maxParallelFileOps: cappedCpuCount() } : {}),
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
