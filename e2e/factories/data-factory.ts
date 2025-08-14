import { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Comprehensive data factory for E2E testing
export class E2EDataFactory {
  private supabase;
  private workspaceId: string | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  // Safety check - never run against production
  private ensureSafeEnvironment() {
    const url = process.env.VITE_SUPABASE_URL || '';
    if (url.includes('production') || process.env.ENVIRONMENT !== 'staging') {
      throw new Error('🚨 SAFETY GUARD: E2E tests can only run against staging environment');
    }
  }

  async seedFullTestEnvironment() {
    this.ensureSafeEnvironment();
    
    console.log('🌱 Starting comprehensive E2E data seeding...');
    
    try {
      // Create workspace and users
      await this.createQAWorkspace();
      await this.createTestUsers();
      
      // Seed business data
      await this.seedCustomers();
      await this.seedSegments();
      await this.seedEvents();
      await this.seedHolidays();
      await this.seedContentBundles();
      await this.seedAutomations();
      await this.seedCampaigns();
      await this.seedAnalyticsFixtures();
      
      console.log('✅ E2E data seeding completed successfully');
      return { workspaceId: this.workspaceId };
      
    } catch (error) {
      console.error('❌ E2E data seeding failed:', error);
      throw error;
    }
  }

  private async createQAWorkspace() {
    const { data: workspace, error } = await this.supabase
      .from('tenants')
      .upsert([{
        name: process.env.QA_WORKSPACE_NAME || 'QA E2E Workspace',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    this.workspaceId = workspace.id;
    console.log(`📁 Created workspace: ${workspace.name} (${workspace.id})`);
  }

  private async createTestUsers() {
    const users = [
      {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
        role: 'super_admin',
        name: 'QA Admin User'
      },
      {
        email: process.env.TEST_EDITOR_EMAIL,
        password: process.env.TEST_EDITOR_PASSWORD,
        role: 'admin',
        name: 'QA Editor User'
      },
      {
        email: process.env.TEST_VIEWER_EMAIL,
        password: process.env.TEST_VIEWER_PASSWORD,
        role: 'viewer',
        name: 'QA Viewer User'
      }
    ];

    for (const user of users) {
      // Create auth user
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: user.email!,
        password: user.password!,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          role: user.role
        }
      });

      if (authError && !authError.message.includes('already registered')) {
        throw authError;
      }

      // Create company profile
      if (authData.user) {
        await this.supabase
          .from('company_profiles')
          .upsert([{
            user_id: authData.user.id,
            company_name: 'QA Test Company',
            company_overview: 'Test company for E2E testing',
            tokens_balance: 1000,
            onboarding_completed_at: new Date().toISOString()
          }]);

        // Create user record
        await this.supabase
          .from('users')
          .upsert([{
            id: authData.user.id,
            tenant_id: this.workspaceId,
            email: user.email,
            name: user.name,
            role: user.role,
            created_by_user_id: authData.user.id
          }]);
      }

      console.log(`👤 Created test user: ${user.name} (${user.role})`);
    }
  }

  private async seedCustomers() {
    const personas = ['Shade Perennials', 'Veggie Starts', 'Houseplants', 'New Customer', 'Landscaper', 'Beginner'];
    const customers = [];

    for (let i = 0; i < 150; i++) {
      customers.push({
        tenant_id: this.workspaceId,
        user_id: await this.getTestUserId(),
        email: `customer${i + 1}@test.com`,
        first_name: `Customer${i + 1}`,
        last_name: 'Test',
        phone: `+1555${String(i + 1).padStart(7, '0')}`,
        persona: personas[i % personas.length],
        tags: [personas[i % personas.length], i % 3 === 0 ? 'VIP' : 'Regular'],
        total_spent: Math.floor(Math.random() * 1000),
        lifetime_value: Math.floor(Math.random() * 2000),
        timezone: 'America/New_York',
        sms_opt_in: i % 4 !== 0, // 75% opt-in rate
        created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    const { error } = await this.supabase
      .from('crm_customers')
      .insert(customers);

    if (error) throw error;
    console.log('👥 Seeded 150 test customers');
  }

  private async seedSegments() {
    const segments = [
      { name: 'Shade Perennials Enthusiasts', filters: { persona: ['Shade Perennials'] } },
      { name: 'Vegetable Gardeners', filters: { persona: ['Veggie Starts'] } },
      { name: 'Indoor Plant Lovers', filters: { persona: ['Houseplants'] } },
      { name: 'New Customers', filters: { persona: ['New Customer'] } },
      { name: 'High Value Customers', filters: { total_spent: { gte: 500 } } },
      { name: 'SMS Opted In', filters: { sms_opt_in: true } }
    ];

    for (const segment of segments) {
      const { error } = await this.supabase
        .from('custom_segments')
        .insert([{
          tenant_id: this.workspaceId,
          user_id: await this.getTestUserId(),
          name: segment.name,
          filters: segment.filters,
          customer_count: Math.floor(Math.random() * 50) + 10
        }]);

      if (error) throw error;
    }

    console.log('🎯 Seeded 6 customer segments');
  }

  private async seedEvents() {
    const today = new Date();
    const events = [
      {
        name: 'Spring Plant Sale',
        start_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toDateString(),
        description: 'Annual spring plant sale event'
      },
      {
        name: 'Garden Workshop',
        start_date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toDateString(),
        description: 'Educational gardening workshop'
      },
      {
        name: 'Houseplant Care Class',
        start_date: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toDateString(),
        description: 'Learn to care for indoor plants'
      },
      {
        name: 'Summer Prep Seminar',
        start_date: new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000).toDateString(),
        description: 'Prepare your garden for summer'
      }
    ];

    for (const event of events) {
      const { error } = await this.supabase
        .from('events')
        .insert([{
          tenant_id: this.workspaceId,
          user_id: await this.getTestUserId(),
          ...event
        }]);

      if (error && !error.message.includes('already exists')) {
        console.warn('Event creation warning:', error.message);
      }
    }

    console.log('📅 Seeded 4 upcoming events');
  }

  private async seedHolidays() {
    const today = new Date();
    const holidays = [];
    
    // Generate next 8 weeks of holidays
    for (let week = 1; week <= 8; week++) {
      const holidayDate = new Date(today.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      holidays.push({
        holiday_name: `Week ${week} Holiday`,
        holiday_date: holidayDate.toDateString(),
        description: `Seasonal holiday for week ${week}`,
        category: 'seasonal',
        is_active: true
      });
    }

    // Add annual holidays
    const annualHolidays = [
      { name: 'Earth Day', month: 4, day: 22 },
      { name: 'Mother\'s Day', month: 5, day: 14 },
      { name: 'Father\'s Day', month: 6, day: 18 },
      { name: 'Summer Solstice', month: 6, day: 21 }
    ];

    for (const holiday of annualHolidays) {
      const year = today.getFullYear();
      const holidayDate = new Date(year, holiday.month - 1, holiday.day);
      if (holidayDate < today) {
        holidayDate.setFullYear(year + 1);
      }

      holidays.push({
        holiday_name: holiday.name,
        holiday_date: holidayDate.toDateString(),
        description: `Annual ${holiday.name} celebration`,
        category: 'annual',
        is_active: true
      });
    }

    for (const holiday of holidays) {
      const { error } = await this.supabase
        .from('holidays')
        .insert([holiday]);

      if (error && !error.message.includes('already exists')) {
        console.warn('Holiday creation warning:', error.message);
      }
    }

    console.log('🎉 Seeded holidays for next 8 weeks + 4 annual holidays');
  }

  private async seedContentBundles() {
    // Create historical content bundles with mixed approvals and media
    const bundles = [
      {
        type: 'event',
        name: 'Spring Sale Bundle',
        items: this.generateBundleItems(['instagram', 'newsletter'], 'spring_sale'),
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        type: 'seasonal',
        name: 'Easter Gardening Bundle',
        items: this.generateBundleItems(['facebook', 'blog'], 'easter_gardening'),
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        type: 'custom',
        name: 'Houseplant Care Tips',
        items: this.generateBundleItems(['instagram', 'video', 'newsletter'], 'houseplant_care'),
        created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const bundle of bundles) {
      // Store bundle in draft_snapshots table
      const { error } = await this.supabase
        .from('draft_snapshots')
        .insert([{
          workspace_id: this.workspaceId,
          bundle_id: `test_${bundle.type}_${Date.now()}`,
          source_id: `test_${bundle.type}`,
          source_label: bundle.name,
          mode: bundle.type,
          data: {
            items: bundle.items,
            recommendedImages: this.generateRecommendedImages()
          },
          created_at: bundle.created_at
        }]);

      if (error) throw error;
    }

    console.log('📦 Seeded 3 historical content bundles');
  }

  private generateBundleItems(channels: string[], theme: string) {
    return channels.map((channel, index) => ({
      id: `item_${channel}_${index}`,
      channel,
      content: `Sample ${channel} content for ${theme}. This is test content generated for E2E testing.`,
      approved: index % 2 === 0, // Mix of approved and unapproved
      _approved: index % 2 === 0,
      media: {
        url: `https://picsum.photos/400/400?random=${Math.floor(Math.random() * 1000)}`,
        alt: `${theme} ${channel} image`
      },
      hashtags: ['#gardening', '#plants', `#${theme}`],
      tone: 'friendly'
    }));
  }

  private generateRecommendedImages() {
    return Array.from({ length: 4 }, (_, i) => ({
      url: `https://picsum.photos/400/400?random=${Math.floor(Math.random() * 1000)}`,
      alt: `Recommended image ${i + 1}`,
      photographer: 'Test Photographer',
      source: 'unsplash'
    }));
  }

  private async seedAutomations() {
    const automations = [
      {
        name: 'Welcome Series',
        trigger_type: 'customer_created',
        workflow_steps: [
          { type: 'sms', delayMin: 5, text: 'Welcome to our garden center!' },
          { type: 'email', delayMin: 1440, subject: 'Getting Started Guide', content: 'Welcome email content' }
        ],
        is_active: true,
        template_source: 'welcome_series'
      },
      {
        name: 'Birthday Offer',
        trigger_type: 'customer_birthday',
        workflow_steps: [
          { type: 'email', delayMin: 0, subject: 'Happy Birthday! 🎉', content: 'Birthday offer email' }
        ],
        is_active: true,
        template_source: 'birthday_offer'
      },
      {
        name: 'Abandoned Cart (Draft)',
        trigger_type: 'cart_abandoned',
        workflow_steps: [
          { type: 'sms', delayMin: 60, text: 'You left something in your cart!' }
        ],
        is_active: false,
        template_source: 'abandoned_cart'
      }
    ];

    for (const automation of automations) {
      const { error } = await this.supabase
        .from('crm_automations')
        .insert([{
          tenant_id: this.workspaceId,
          user_id: await this.getTestUserId(),
          ...automation
        }]);

      if (error) throw error;
    }

    console.log('🤖 Seeded 3 automation workflows');
  }

  private async seedCampaigns() {
    const campaigns = [
      {
        name: 'Spring Newsletter',
        type: 'email',
        status: 'sent',
        sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        metrics: { sent: 145, delivered: 142, opened: 67, clicked: 23 }
      },
      {
        name: 'Plant Care Tips SMS',
        type: 'sms',
        status: 'sent',
        sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        metrics: { sent: 98, delivered: 96, opened: 0, clicked: 12 }
      },
      {
        name: 'Summer Sale Announcement',
        type: 'email',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
      },
      {
        name: 'Workshop Reminder MMS',
        type: 'sms',
        status: 'draft',
        message: 'Don\'t forget about tomorrow\'s workshop! 🌱',
        media_urls: ['https://picsum.photos/300/200?random=workshop'],
        metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
      }
    ];

    for (const campaign of campaigns) {
      const { error } = await this.supabase
        .from('crm_sms_campaigns')
        .insert([{
          tenant_id: this.workspaceId,
          user_id: await this.getTestUserId(),
          ...campaign
        }]);

      if (error) throw error;
    }

    console.log('📧 Seeded 4 campaigns (email & SMS)');
  }

  private async seedAnalyticsFixtures() {
    // Insert minimal analytics data so dashboards render non-empty
    const attributions = [
      {
        campaign_id: 'test_campaign_1',
        customer_id: 'test_customer_1',
        revenue: 125.50,
        conversion_type: 'purchase',
        attributed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        campaign_id: 'test_campaign_2',
        customer_id: 'test_customer_2',
        revenue: 89.99,
        conversion_type: 'purchase',
        attributed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const attribution of attributions) {
      const { error } = await this.supabase
        .from('campaign_attribution')
        .insert([attribution]);

      if (error && !error.message.includes('does not exist')) {
        console.warn('Analytics seeding warning:', error.message);
      }
    }

    console.log('📊 Seeded analytics fixtures');
  }

  private async getTestUserId(): Promise<string> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id')
      .eq('tenant_id', this.workspaceId)
      .eq('role', 'super_admin')
      .single();

    if (error || !data) {
      throw new Error('Could not find test user ID');
    }

    return data.id;
  }

  async cleanup() {
    this.ensureSafeEnvironment();
    
    console.log('🧹 Cleaning up E2E test data...');
    
    try {
      if (this.workspaceId) {
        // Delete all data for the QA workspace
        await this.supabase.from('draft_snapshots').delete().eq('workspace_id', this.workspaceId);
        await this.supabase.from('crm_customers').delete().eq('tenant_id', this.workspaceId);
        await this.supabase.from('custom_segments').delete().eq('tenant_id', this.workspaceId);
        await this.supabase.from('crm_automations').delete().eq('tenant_id', this.workspaceId);
        await this.supabase.from('crm_sms_campaigns').delete().eq('tenant_id', this.workspaceId);
        await this.supabase.from('users').delete().eq('tenant_id', this.workspaceId);
        
        // Delete auth users
        const testEmails = [
          process.env.TEST_ADMIN_EMAIL,
          process.env.TEST_EDITOR_EMAIL,
          process.env.TEST_VIEWER_EMAIL
        ];

        for (const email of testEmails) {
          if (email) {
            await this.supabase.auth.admin.deleteUser(email);
          }
        }
      }
      
      console.log('✅ E2E test data cleanup completed');
    } catch (error) {
      console.error('❌ E2E cleanup failed:', error);
    }
  }
}