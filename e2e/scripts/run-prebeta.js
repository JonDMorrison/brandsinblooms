#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 BloomSuite Pre-Beta E2E Test Runner');
console.log('=====================================\n');

// Load environment variables
require('dotenv').config({ path: '.env.e2e' });

// Safety check
if (process.env.ENVIRONMENT !== 'staging') {
  console.error('🚨 SAFETY GUARD: E2E tests can only run in staging environment');
  process.exit(1);
}

async function runPreBetaTests() {
  try {
    console.log('📋 Running Pre-Beta Test Suite...\n');
    
    // Suites to run in order
    const testSuites = [
      'core-workflows.spec.ts',
      'create-post-workflows.spec.ts', 
      'advanced-crm.spec.ts',
      'admin-permissions.spec.ts',
      'error-handling.spec.ts'
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const suite of testSuites) {
      console.log(`🔄 Running ${suite}...`);
      
      const result = await runSuite(suite);
      
      if (result.success) {
        totalPassed++;
        console.log(`✅ ${suite} - PASSED\n`);
      } else {
        totalFailed++;
        console.log(`❌ ${suite} - FAILED\n`);
      }
    }
    
    // Summary
    console.log('🏁 PRE-BETA TEST RESULTS');
    console.log('========================');
    console.log(`✅ Passed: ${totalPassed}/${testSuites.length}`);
    console.log(`❌ Failed: ${totalFailed}/${testSuites.length}`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! BloomSuite is ready for beta.');
    } else {
      console.log(`\n⚠️  ${totalFailed} test suite(s) failed. Review reports before beta release.`);
    }
    
    console.log('\n📊 View detailed reports:');
    console.log('- HTML Report: npx playwright show-report');
    console.log('- JSON Report: e2e/reports/results.json');
    console.log('- Markdown Report: e2e/reports/bloomsuite_prebeta_report.md');
    
  } catch (error) {
    console.error('❌ Pre-beta test execution failed:', error);
    process.exit(1);
  }
}

function runSuite(suiteName) {
  return new Promise((resolve) => {
    const args = [
      'test',
      `e2e/suites/${suiteName}`,
      '--project=chromium',
      '--reporter=line'
    ];
    
    const child = spawn('npx', ['playwright', ...args], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    child.on('close', (code) => {
      resolve({ success: code === 0 });
    });
  });
}

// Run the pre-beta test suite
runPreBetaTests();