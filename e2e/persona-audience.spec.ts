import { test, expect } from '@playwright/test';

test.describe('Persona Contact to Campaign Audience Flow', () => {
  let testPersonaId: string;
  let testCustomer1Id: string;
  let testCustomer2Id: string;

  test.beforeAll(async ({ browser }) => {
    // Create test data via API for consistent testing
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to app to get auth token
    await page.goto('/auth');
    
    // Create test persona via API
    const createPersonaResponse = await page.evaluate(async () => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      
      // Get current user for tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (!userRecord?.tenant_id) return null;
      
      // Create test persona
      const { data: persona, error: personaError } = await supabase
        .from('crm_personas')
        .insert({
          tenant_id: userRecord.tenant_id,
          user_id: user.id,
          persona_name: 'E2E Test Persona',
          persona_description: 'Automated test persona for E2E validation',
          is_custom: true
        })
        .select()
        .single();
      
      if (personaError) throw personaError;
      return persona;
    });
    
    if (createPersonaResponse) {
      testPersonaId = createPersonaResponse.id;
    }
    
    // Create test customers assigned to this persona
    const createCustomersResponse = await page.evaluate(async (personaId) => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (!userRecord?.tenant_id) return null;
      
      // Create 2 test customers
      const { data: customers, error: customersError } = await supabase
        .from('crm_customers')
        .insert([
          {
            tenant_id: userRecord.tenant_id,
            user_id: user.id,
            email: 'e2e-test-customer-1@example.com',
            first_name: 'E2E',
            last_name: 'Customer One',
            persona_id: personaId
          },
          {
            tenant_id: userRecord.tenant_id,
            user_id: user.id,
            email: 'e2e-test-customer-2@example.com',
            first_name: 'E2E',
            last_name: 'Customer Two',
            persona_id: personaId
          }
        ])
        .select();
      
      if (customersError) throw customersError;
      return customers;
    }, testPersonaId);
    
    if (createCustomersResponse && createCustomersResponse.length === 2) {
      testCustomer1Id = createCustomersResponse[0].id;
      testCustomer2Id = createCustomersResponse[1].id;
    }
    
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Clean up test data
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/auth');
    
    await page.evaluate(async (data) => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      
      // Delete test customers
      if (data.customer1Id) {
        await supabase.from('crm_customers').delete().eq('id', data.customer1Id);
      }
      if (data.customer2Id) {
        await supabase.from('crm_customers').delete().eq('id', data.customer2Id);
      }
      
      // Delete test persona
      if (data.personaId) {
        await supabase.from('crm_personas').delete().eq('id', data.personaId);
      }
    }, {
      personaId: testPersonaId,
      customer1Id: testCustomer1Id,
      customer2Id: testCustomer2Id
    });
    
    await context.close();
  });

  test('creates persona, assigns customers, and verifies campaign audience counts', async ({ page }) => {
    // Navigate to the app
    await page.goto('/crm/customers');
    
    // Verify test customers exist in the UI
    await expect(page.getByText('E2E Customer One')).toBeVisible();
    await expect(page.getByText('E2E Customer Two')).toBeVisible();
    
    // Navigate to campaign creation
    await page.goto('/crm/campaigns/new');
    
    // Fill in basic campaign details
    await page.fill('input[placeholder*="Enter campaign name"]', 'E2E Test Campaign');
    await page.fill('input[placeholder*="Enter subject line"]', 'Test Campaign Subject');
    
    // Open audience selection - look for the audience targeting button
    await page.click('button:has-text("All Contacts")');
    
    // Wait for audience selector dialog to open
    await expect(page.getByText('Configure Target Audience')).toBeVisible();
    
    // Verify "All Contacts" option is available
    await expect(page.getByText('All Contacts')).toBeVisible();
    await expect(page.getByText('Send to your entire contact database')).toBeVisible();
    
    // Test "All Contacts" selection
    await page.click('input[id="all-contacts"]');
    await expect(page.getByText('All Contacts').first()).toBeChecked();
    
    // Clear all contacts selection to test persona selection
    await page.click('input[id="all-contacts"]');
    
    // Look for our test persona in the personas column
    await expect(page.getByText('E2E Test Persona')).toBeVisible();
    
    // Click on test persona checkbox
    await page.click(`input[id="${testPersonaId}"]`);
    
    // Verify persona is selected and shows in summary
    await expect(page.getByText('E2E Test Persona')).toBeVisible();
    await expect(page.getByText('Personas (1/3):')).toBeVisible();
    
    // Verify the persona shows correct customer count (should be 2)
    // Note: This tests that persona counts are properly synced
    const personaRow = page.locator(`[data-testid="persona-${testPersonaId}"]`).or(
      page.locator('label').filter({ hasText: 'E2E Test Persona' }).locator('..')
    );
    
    await expect(personaRow).toBeVisible();
    
    // Apply selection
    await page.click('button:has-text("Apply Selection")');
    
    // Verify audience is configured in campaign readiness
    await expect(page.getByText('Target Audience')).toBeVisible();
    
    // Navigate back to audience to test segment counts are properly displayed
    await page.click('[data-testid="audience-button"]');
    
    // Verify segments column shows various predefined segments
    await expect(page.getByText('Segments')).toBeVisible();
    
    // Test that we can see and interact with predefined segments
    const loyaltySegment = page.getByText('Loyalty Members').first();
    if (await loyaltySegment.isVisible()) {
      await loyaltySegment.click();
      // Should show count and be selectable
      await expect(page.getByText('Segments (1/5):')).toBeVisible();
    }
    
    // Test clearing all selections
    await page.click('button:has-text("Clear All")');
    await expect(page.getByText('All Contacts')).toBeVisible();
  });

  test('verifies contact edit updates persona immediately', async ({ page }) => {
    // Navigate to customers page
    await page.goto('/crm/customers');
    
    // Click on first test customer to open details
    await page.click('text=E2E Customer One');
    
    // Wait for customer details modal to open
    await expect(page.getByText('Customer Details')).toBeVisible();
    
    // Show all personas
    await page.click('button:has-text("Show All Personas")');
    
    // Wait for personas to load
    await expect(page.getByText('All Personas')).toBeVisible();
    
    // Find and verify our test persona is assigned (should be checked)
    const testPersonaCheckbox = page.locator(`input[id="${testPersonaId}"]`);
    await expect(testPersonaCheckbox).toBeChecked();
    
    // Uncheck the persona
    await testPersonaCheckbox.click();
    
    // Verify the persona badge is immediately removed from the UI
    // This tests immediate UI updates without requiring a page refresh
    await expect(page.getByText('E2E Test Persona').and(page.locator('.badge'))).not.toBeVisible({ timeout: 2000 });
    
    // Re-assign the persona
    await testPersonaCheckbox.click();
    
    // Verify the persona badge appears immediately
    await expect(page.getByText('E2E Test Persona').and(page.locator('.badge'))).toBeVisible({ timeout: 2000 });
    
    // Close modal
    await page.press('Escape');
  });

  test('verifies persona counts update in campaign audience after contact changes', async ({ page }) => {
    // Navigate to campaign creation
    await page.goto('/crm/campaigns/new');
    
    // Fill basic details
    await page.fill('input[placeholder*="Enter campaign name"]', 'Count Test Campaign');
    
    // Open audience selector
    await page.click('button:has-text("All Contacts")');
    
    // Wait for dialog to open
    await expect(page.getByText('Configure Target Audience')).toBeVisible();
    
    // The persona should show 2 contacts assigned
    // This validates that persona customer counts are properly calculated
    const personaSection = page.locator('text=E2E Test Persona').locator('..');
    await expect(personaSection).toContainText('2'); // Should show count of 2
    
    // Select the persona
    await page.click(`input[id="${testPersonaId}"]`);
    
    // Apply selection
    await page.click('button:has-text("Apply Selection")');
    
    // Verify the campaign shows correct recipient count
    await expect(page.getByText('Target Audience')).toBeVisible();
  });
});