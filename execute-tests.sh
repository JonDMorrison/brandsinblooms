#!/bin/bash

echo "🧪 EXECUTING COMPLETE E2E TEST SUITE"
echo "===================================="
echo ""

# Set environment variables for testing
export VITE_SUPABASE_URL="https://udldmkqwnxhdeztyqcau.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM"

echo "🔧 Installing Playwright browsers..."
npx playwright install --with-deps

echo ""
echo "📋 TEST EXECUTION ORDER:"
echo "1. Basic Application Tests"
echo "2. Authentication Flow Tests" 
echo "3. Customer Management Tests"
echo "4. SMS Campaign Tests"
echo "5. Automation Builder Tests"
echo "6. Twilio Integration Tests"
echo ""

# Track results
PASSED=0
FAILED=0
TOTAL=6

echo "🎬 Starting test execution..."
echo ""

# Test 1: Basic Application
echo "1️⃣ Running Basic Application Tests..."
if npx playwright test e2e/basic-test.spec.ts --reporter=line; then
    echo "✅ Basic Application Tests - PASSED"
    ((PASSED++))
else
    echo "❌ Basic Application Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Test 2: Authentication 
echo "2️⃣ Running Authentication Flow Tests..."
if npx playwright test e2e/auth/authentication.spec.ts --reporter=line; then
    echo "✅ Authentication Flow Tests - PASSED"
    ((PASSED++))
else
    echo "❌ Authentication Flow Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Test 3: Customer Management
echo "3️⃣ Running Customer Management Tests..."
if npx playwright test e2e/crm/customer-management.spec.ts --reporter=line; then
    echo "✅ Customer Management Tests - PASSED"
    ((PASSED++))
else
    echo "❌ Customer Management Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Test 4: SMS Campaigns
echo "4️⃣ Running SMS Campaign Tests..."
if npx playwright test e2e/campaigns/sms-campaigns.spec.ts --reporter=line; then
    echo "✅ SMS Campaign Tests - PASSED"
    ((PASSED++))
else
    echo "❌ SMS Campaign Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Test 5: Automation Builder
echo "5️⃣ Running Automation Builder Tests..."
if npx playwright test e2e/automations/automation-builder.spec.ts --reporter=line; then
    echo "✅ Automation Builder Tests - PASSED"
    ((PASSED++))
else
    echo "❌ Automation Builder Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Test 6: Twilio Integration
echo "6️⃣ Running Twilio Integration Tests..."
if npx playwright test e2e/integrations/twilio-integration.spec.ts --reporter=line; then
    echo "✅ Twilio Integration Tests - PASSED"
    ((PASSED++))
else
    echo "❌ Twilio Integration Tests - FAILED"
    ((FAILED++))
fi
echo ""

# Final Results
echo "🏁 FINAL TEST RESULTS"
echo "====================="
echo "✅ Passed: $PASSED/$TOTAL"
echo "❌ Failed: $FAILED/$TOTAL"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED! E2E infrastructure is fully operational."
    echo "📊 Generate HTML report: npx playwright show-report"
else
    echo ""
    echo "⚠️  $FAILED test suite(s) failed. Review logs above for details."
    echo "🔧 Troubleshooting: Check dev server, database connectivity, and test data"
fi