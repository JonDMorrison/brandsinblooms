#!/usr/bin/env node

const { E2EDataFactory } = require('../factories/data-factory.ts');

async function seedTestData() {
  console.log('🌱 Starting E2E test data seeding...');
  
  try {
    const factory = new E2EDataFactory();
    const result = await factory.seedFullTestEnvironment();
    
    console.log('✅ Test data seeding completed successfully');
    console.log(`📁 Workspace ID: ${result.workspaceId}`);
    console.log('🔑 Test credentials:');
    console.log(`   Admin: ${process.env.TEST_ADMIN_EMAIL}`);
    console.log(`   Editor: ${process.env.TEST_EDITOR_EMAIL}`);
    console.log(`   Viewer: ${process.env.TEST_VIEWER_EMAIL}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test data seeding failed:', error);
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.e2e' });

seedTestData();