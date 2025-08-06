import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "process.env.VITE_ENABLE_SENTINEL": JSON.stringify("false")
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/_sandbox': {
        target: 'https://be93a2db-7d1b-4b46-8348-60c7c8b0b42f.lovableprojects.com',
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
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
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