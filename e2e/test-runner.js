#!/usr/bin/env node

// Simple test runner to verify E2E setup
const { execSync } = require('child_process');

console.log('🚀 Starting E2E Test Suite...\n');

try {
  // Install Playwright browsers if needed
  console.log('📦 Installing Playwright browsers...');
  execSync('npx playwright install --with-deps', { stdio: 'inherit' });
  
  // Run a basic auth test
  console.log('\n🔐 Running authentication tests...');
  execSync('npx playwright test e2e/auth/authentication.spec.ts --headed', { stdio: 'inherit' });
  
  console.log('\n✅ E2E tests completed successfully!');
} catch (error) {
  console.error('\n❌ E2E tests failed:', error.message);
  process.exit(1);
}