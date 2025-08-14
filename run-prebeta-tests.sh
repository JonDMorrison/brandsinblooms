#!/bin/bash

echo "🧪 Starting BloomSuite Pre-Beta Test Suite"
echo "=========================================="

# Load environment variables
export $(cat .env.e2e | xargs)

# Safety check
if [ "$ENVIRONMENT" != "staging" ]; then
  echo "🚨 SAFETY GUARD: E2E tests can only run in staging environment"
  exit 1
fi

# Install dependencies if needed
echo "📦 Installing Playwright browsers..."
npx playwright install --with-deps

# Seed test data
echo "🌱 Seeding test data..."
node e2e/scripts/seed-data.js

# Run the pre-beta test suite
echo "🚀 Running pre-beta test suite..."
node e2e/scripts/run-prebeta.js

echo "✅ Pre-beta test execution complete!"