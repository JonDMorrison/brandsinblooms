#!/usr/bin/env node

const { E2EDataFactory } = require('../factories/data-factory.ts');

async function cleanupTestData() {
  console.log('🧹 Starting E2E test data cleanup...');
  
  try {
    const factory = new E2EDataFactory();
    await factory.cleanup();
    
    console.log('✅ Test data cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test data cleanup failed:', error);
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.e2e' });

cleanupTestData();