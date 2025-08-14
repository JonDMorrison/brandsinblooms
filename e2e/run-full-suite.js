#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 COMPLETE E2E TEST SUITE EXECUTION');
console.log('=====================================\n');

// Test execution configuration
const tests = [
  {
    name: 'Basic Application Tests',
    file: 'e2e/basic-test.spec.ts',
    description: 'Verifies basic app loading and navigation'
  },
  {
    name: 'Authentication Flow Tests',
    file: 'e2e/auth/authentication.spec.ts',
    description: 'Tests signup, login, password reset, and logout flows'
  },
  {
    name: 'Customer Management Tests',
    file: 'e2e/crm/customer-management.spec.ts',
    description: 'Tests CRM customer operations and data management'
  },
  {
    name: 'SMS Campaign Tests',
    file: 'e2e/campaigns/sms-campaigns.spec.ts',
    description: 'Tests campaign creation, scheduling, and sending'
  },
  {
    name: 'Automation Builder Tests',
    file: 'e2e/automations/automation-builder.spec.ts',
    description: 'Tests automation creation and management workflows'
  },
  {
    name: 'Twilio Integration Tests',
    file: 'e2e/integrations/twilio-integration.spec.ts',
    description: 'Tests SMS/MMS sending and webhook processing'
  }
];

// Environment setup
process.env.VITE_SUPABASE_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM';

let results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: tests.length
};

console.log('🔧 Setting up test environment...');
try {
  execSync('npx playwright install --with-deps', { stdio: 'pipe' });
  console.log('✅ Playwright browsers installed\n');
} catch (error) {
  console.log('⚠️  Browser installation skipped (may already be installed)\n');
}

// Run each test suite
for (const testSuite of tests) {
  console.log(`📋 Running: ${testSuite.name}`);
  console.log(`   ${testSuite.description}`);
  console.log(`   File: ${testSuite.file}\n`);
  
  try {
    execSync(`npx playwright test ${testSuite.file} --reporter=line`, { 
      stdio: 'inherit',
      timeout: 300000 // 5 minutes per suite
    });
    
    results.passed++;
    console.log(`✅ ${testSuite.name} - PASSED\n`);
    
  } catch (error) {
    results.failed++;
    console.log(`❌ ${testSuite.name} - FAILED`);
    console.log(`   Error: ${error.message}\n`);
  }
}

// Final results
console.log('🏁 FINAL TEST RESULTS');
console.log('=====================');
console.log(`✅ Passed: ${results.passed}/${results.total}`);
console.log(`❌ Failed: ${results.failed}/${results.total}`);
console.log(`⏭️  Skipped: ${results.skipped}/${results.total}`);

if (results.failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! E2E suite is working perfectly.');
} else {
  console.log(`\n⚠️  ${results.failed} test suite(s) failed. Check logs above for details.`);
}

console.log('\n📊 For detailed reports, run: npx playwright show-report');