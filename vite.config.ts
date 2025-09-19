import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "process.env.VITE_ENABLE_SENTINEL": JSON.stringify(process.env.VITE_ENABLE_SENTINEL || "false")
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/_sandbox': {
        target: 'https://be93ec50-2043-42c4-b91c-5d7c30f0ef2d.lovableproject.com',
        changeOrigin: true,
        secure: true,
        headers: {
          'Origin': 'https://lovable.dev'
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          supabase: ['@supabase/supabase-js'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
}));