#!/bin/bash

echo "🚀 Starting E2E Test Suite Setup Verification..."

# Set environment variables
export VITE_SUPABASE_URL="https://udldmkqwnxhdeztyqcau.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM"

echo "📦 Installing Playwright browsers..."
npx playwright install --with-deps

echo "🏃 Running basic E2E verification tests..."
npx playwright test e2e/basic-test.spec.ts --headed

echo "🔐 Running authentication flow tests..."
npx playwright test e2e/auth/authentication.spec.ts --headed

echo "✅ E2E test setup verification complete!"