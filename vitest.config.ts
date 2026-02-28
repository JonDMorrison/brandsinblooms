
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{ts,tsx,js,jsx}',
      '__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}',
    ],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
      '.supabase/**',
      'supabase/**',
    ],
  },
})
