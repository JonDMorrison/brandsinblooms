import { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test environment configuration
export const TEST_CONFIG = {
  supabaseUrl: 'https://udldmkqwnxhdeztyqcau.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM',
  testUserEmail: 'test-user@example.com',
  testUserPassword: 'testpassword123',
  testPhoneNumbers: ['6048393258', '6041234567'],
  baseUrl: 'http://localhost:5173',
};

// Test data factory
export class TestDataFactory {
  static generateTestUser() {
    const timestamp = Date.now();
    return {
      email: `test-user-${timestamp}@example.com`,
      password: 'TestPassword123!',
      fullName: `Test User ${timestamp}`,
      companyName: `Test Company ${timestamp}`,
    };
  }

  static generateTestCustomer() {
    const timestamp = Date.now();
    return {
      firstName: `John-${timestamp}`,
      lastName: `Doe-${timestamp}`,
      email: `customer-${timestamp}@example.com`,
      phone: '+16048393258',
      tags: ['test-customer'],
    };
  }

  static generateTestCampaign() {
    const timestamp = Date.now();
    return {
      name: `Test Campaign ${timestamp}`,
      message: `Test message sent at ${new Date().toISOString()}`,
      scheduledFor: new Date(Date.now() + 60000), // 1 minute from now
    };
  }
}

// Database utilities for test setup and cleanup
export class TestDatabaseUtils {
  private supabase;

  constructor() {
    this.supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);
  }

  async createTestUser(userData: ReturnType<typeof TestDataFactory.generateTestUser>) {
    const { data, error } = await this.supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName,
          business_name: userData.companyName,
        },
      },
    });

    if (error) throw error;
    return data;
  }

  async cleanupTestData(userEmail: string) {
    // Sign in as the test user first
    const { data: authData } = await this.supabase.auth.signInWithPassword({
      email: userEmail,
      password: 'TestPassword123!',
    });

    if (authData.user) {
      // Delete test data in order (respecting foreign keys)
      await this.supabase.from('crm_outbox').delete().eq('user_id', authData.user.id);
      await this.supabase.from('crm_customers').delete().eq('user_id', authData.user.id);
      await this.supabase.from('crm_campaigns').delete().eq('user_id', authData.user.id);
      await this.supabase.from('crm_automations').delete().eq('user_id', authData.user.id);
      await this.supabase.from('company_profiles').delete().eq('user_id', authData.user.id);
      
      // Sign out and delete the auth user
      await this.supabase.auth.signOut();
    }
  }

  async seedTestData(userId: string) {
    // Create test customers
    const testCustomers = Array.from({ length: 5 }, () => TestDataFactory.generateTestCustomer());
    
    for (const customer of testCustomers) {
      await this.supabase.from('crm_customers').insert({
        user_id: userId,
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        tags: customer.tags,
      });
    }

    return { customers: testCustomers };
  }
}

// Page utilities for common operations
export class PageUtils {
  constructor(private page: Page) {}

  async waitForApp() {
    // Wait for the app to load and authentication to complete
    await this.page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  }

  async login(email: string, password: string) {
    await this.page.goto('/auth');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.waitForApp();
  }

  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(`[name="${field}"], [data-testid="${field}"]`, value);
    }
  }

  async clickAndWait(selector: string, waitFor: 'navigation' | 'response' | 'selector' = 'navigation') {
    const clickPromise = this.page.click(selector);
    
    switch (waitFor) {
      case 'navigation':
        await Promise.all([this.page.waitForNavigation(), clickPromise]);
        break;
      case 'response':
        await Promise.all([this.page.waitForResponse('**/api/**'), clickPromise]);
        break;
      case 'selector':
        await clickPromise;
        break;
    }
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
}