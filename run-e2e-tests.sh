#!/bin/bash

echo "🚀 Starting E2E Test Suite Setup Verification..."

# Set environment variables
export VITE_SUPABASE_URL="https://udldmkqwnxhdeztyqcau.supabase.co"
: "${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY must be set}"
export VITE_SUPABASE_ANON_KEY

echo "📦 Installing Playwright browsers..."
npx playwright install --with-deps

echo "🏃 Running basic E2E verification tests..."
npx playwright test e2e/basic-test.spec.ts --headed

echo "🔐 Running authentication flow tests..."
npx playwright test e2e/auth/authentication.spec.ts --headed

echo "✅ E2E test setup verification complete!"
