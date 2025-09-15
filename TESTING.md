# Testing Setup for Persona/Contact -> Campaign Audience Flows

## Overview

This document describes the automated test suite for persona and contact management, specifically testing the flows from contact editing to campaign audience building.

## Test Structure

### 1. Unit Tests (`__tests__/`)

**ContactEditModal.test.jsx**
- Tests immediate UI updates when persona is changed
- Validates that persona changes reflect instantly without page refresh
- Ensures error handling for failed persona updates

**contactsStore.test.js** 
- Integration test for persona customer counting logic
- Tests the unified approach (persona_id + legacy persona field)  
- Validates counts update when personas are added/removed

### 2. E2E Tests (`e2e/`)

**persona-audience.spec.ts**
- End-to-end test covering the complete flow:
  - Creates test persona via API
  - Creates 2 test customers assigned to persona
  - Verifies persona shows correct count (2) in campaign audience
  - Tests "Add all contacts" option exists and works
  - Validates immediate UI updates in contact edit modal

## Required Package.json Scripts

Since package.json is read-only, add these scripts manually:

\`\`\`json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts", 
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:e2e"
  }
}
\`\`\`

## Running Tests Locally

### Prerequisites
\`\`\`bash
npm ci
\`\`\`

### Unit Tests
\`\`\`bash
npm run test:unit
\`\`\`

### Integration Tests  
\`\`\`bash
npm run test:integration
\`\`\`

### E2E Tests
\`\`\`bash
# Interactive mode
npm run test:e2e:ui

# Headless mode
npm run test:e2e
\`\`\`

### All Tests
\`\`\`bash
npm run test:all
\`\`\`

## Test Environment Setup

### Environment Variables
Create \`.env.test\` with:
\`\`\`
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

### Database Setup
The E2E tests create and clean up their own test data:
- Test personas with custom names
- Test customers assigned to personas
- Automatic cleanup after tests complete

## Key Test Scenarios

### 1. Immediate UI Updates
Tests that when a user changes a contact's persona in the edit modal, the UI updates immediately without requiring:
- Page refresh
- Modal close/reopen
- API polling

### 2. Persona Count Synchronization
Validates that persona customer counts are accurate in campaign audience builder:
- Unified counting (persona_id + legacy persona field)
- Real-time updates when contacts are assigned/unassigned
- Proper handling of custom vs predefined personas

### 3. Campaign Audience Options
Ensures the campaign audience builder provides:
- "Add all contacts" option for entire list targeting
- Accurate persona counts for targeted campaigns
- Proper segment selection with counts
- Clear selection and multi-select capabilities

## Troubleshooting

### Common Issues

1. **Test Database Permissions**
   - Ensure service role key has proper permissions
   - Check RLS policies allow test data creation

2. **Component Mocking**
   - Supabase client must be properly mocked
   - Toast notifications need mock implementation
   - Query client requires test wrapper

3. **E2E Test Stability**
   - Tests create their own data to avoid conflicts
   - Proper cleanup prevents data leakage
   - Timeouts configured for slower CI environments

### Debug Mode

For focused testing:
\`\`\`bash
# Run specific test file
npx vitest __tests__/ContactEditModal.test.jsx

# Run with UI for debugging
npx vitest --ui

# Run specific E2E test
npx playwright test persona-audience.spec.ts --debug
\`\`\`

## CI/CD Integration

The test suite is designed to run in CI environments:
- Unit tests run in Node.js with jsdom
- E2E tests use Playwright with browser automation
- Test data is isolated and cleaned up automatically
- Screenshots/videos captured on failure

## Expected Results

When all tests pass, you should see:
- ✅ ContactEditModal renders and updates immediately
- ✅ Persona counts calculated correctly with unified approach  
- ✅ Campaign audience shows accurate counts and "All Contacts" option
- ✅ E2E flow works end-to-end from contact edit to campaign send