#!/usr/bin/env node

// Quick test runner for immediate validation
const { execSync } = require('child_process');

console.log('🚀 Quick E2E Test Validation');
console.log('=============================\n');

// Set environment variables
process.env.VITE_SUPABASE_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM';

try {
  console.log('1️⃣ Testing basic app functionality...');
  execSync('npx playwright test e2e/basic-test.spec.ts --reporter=line', { stdio: 'inherit' });
  console.log('✅ Basic tests passed!\n');

  console.log('2️⃣ Testing authentication flow...');  
  execSync('npx playwright test e2e/auth/authentication.spec.ts --max-failures=1 --reporter=line', { stdio: 'inherit' });
  console.log('✅ Authentication tests passed!\n');

  console.log('🎉 Quick validation complete - E2E infrastructure is working!');
  
} catch (error) {
  console.error('❌ Quick test failed:', error.message);
  console.log('\n🔧 Troubleshooting tips:');
  console.log('- Ensure the dev server is running: npm run dev');
  console.log('- Check network connectivity to Supabase');
  console.log('- Verify test data cleanup between runs');
}