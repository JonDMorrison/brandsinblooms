import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Diverse name pools
const firstNames = [
  // American
  'Michael', 'Sarah', 'James', 'Emily', 'David', 'Jessica', 'Robert', 'Jennifer',
  // Hispanic
  'Sofia', 'Carlos', 'Maria', 'Jose', 'Ana', 'Diego', 'Isabella', 'Miguel',
  // Asian
  'Wei', 'Mei', 'Hiroshi', 'Yuki', 'Priya', 'Raj', 'Li', 'Chen',
  // African
  'Aisha', 'Kwame', 'Zuri', 'Jamal', 'Amara', 'Malik', 'Nia', 'Kofi',
  // Middle Eastern
  'Mohammed', 'Fatima', 'Ali', 'Leila', 'Omar', 'Yasmin', 'Hassan', 'Nour',
  // European
  'Olga', 'Ivan', 'Elena', 'Anders', 'Ingrid', 'Pietro', 'Francesca', 'Klaus',
  // More diverse names
  'Takashi', 'Sakura', 'Ravi', 'Lakshmi', 'Chioma', 'Olusegun', 'Fatou', 'Amadou',
  'Lucia', 'Antonio', 'Svetlana', 'Dmitri', 'Natasha', 'Alejandra', 'Fernando', 'Carmen',
  'Kevin', 'Amanda', 'Brian', 'Melissa', 'Christopher', 'Ashley', 'Daniel', 'Nicole',
  'Matthew', 'Lauren', 'Andrew', 'Rachel', 'Joshua', 'Stephanie', 'Ryan', 'Rebecca'
];

const lastNames = [
  // American
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  // Hispanic
  'Martinez', 'Rodriguez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez',
  // Asian
  'Nguyen', 'Kim', 'Lee', 'Park', 'Chen', 'Wang', 'Patel', 'Singh',
  // African
  'Okafor', 'Mensah', 'Diallo', 'Kamara', 'Ndiaye', 'Traore', 'Kone', 'Toure',
  // Middle Eastern
  'Ahmed', 'Hassan', 'Ali', 'Ibrahim', 'Khan', 'Shah', 'Malik', 'Hussain',
  // European
  'Mueller', 'Schmidt', 'Rossi', 'Russo', 'Kowalski', 'Novak', 'Andersson', 'Jensen',
  // More surnames
  'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson',
  'Wilson', 'Moore', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young'
];

const emailDomains = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com',
  'aol.com', 'protonmail.com', 'mail.com', 'zoho.com'
];

const areaCodes = [
  '206', '503', '415', '310', '212', '312', '617', '305', '702', '602',
  '713', '214', '480', '619', '408', '720', '404', '512', '303', '971'
];

const timezones = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Phoenix',
  'Pacific/Honolulu',
];

const tagPool = [
  'VIP', 'Regular', 'Occasional', 'First-Time', 'Returning',
  'Perennials', 'Annuals', 'Vegetables', 'Houseplants', 'Succulents',
  'Native-Plants', 'Roses', 'Trees', 'Shrubs', 'Tools',
  'Professional', 'Homeowner', 'Renter', 'Business', 'Hobbyist',
  'Email-Active', 'SMS-Subscriber', 'Workshop-Attendee', 'Loyalty-Member',
  'Spring-Buyer', 'Summer-Buyer', 'Fall-Buyer', 'Holiday-Shopper'
];

const personas = [
  { name: 'Shade Perennials', description: 'Customers who prefer shade-loving perennial plants' },
  { name: 'Veggie Starts', description: 'Vegetable garden enthusiasts' },
  { name: 'Houseplant Collector', description: 'Indoor plant enthusiasts' },
  { name: 'Landscaper Pro', description: 'Professional landscapers and contractors' },
  { name: 'Native Plants', description: 'Eco-conscious customers interested in native species' },
  { name: 'Rose Gardener', description: 'Rose and flowering shrub enthusiasts' },
  { name: 'Succulent Lover', description: 'Drought-tolerant plant collectors' },
  { name: 'Beginner Gardener', description: 'New to gardening, need guidance' }
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function generatePhone(): string {
  const areaCode = randomElement(areaCodes);
  const exchange = randomInt(200, 999);
  const number = randomInt(1000, 9999);
  return `+1-${areaCode}-${exchange}-${number}`;
}

function generateEmail(firstName: string, lastName: string): string {
  const patterns = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}${randomInt(1, 99)}`,
    `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
  ];
  const pattern = randomElement(patterns);
  const domain = randomElement(emailDomains);
  return `${pattern}@${domain}`;
}

function generateHistoricalDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function generateCustomerSegment(index: number, total: number) {
  const ratio = index / total;
  
  // High Value VIP (5%)
  if (ratio < 0.05) {
    return {
      segment: 'High Value VIP',
      lifetimeValue: randomFloat(2000, 10000),
      totalSpent: randomFloat(1500, 8000),
      lastPurchaseDays: randomInt(1, 30),
      createdDays: randomInt(180, 730),
      tags: ['VIP', randomElement(['Perennials', 'Trees', 'Shrubs']), 'Loyalty-Member', 'Email-Active']
    };
  }
  
  // Regular Enthusiast (30%)
  if (ratio < 0.35) {
    return {
      segment: 'Regular Enthusiast',
      lifetimeValue: randomFloat(500, 2000),
      totalSpent: randomFloat(300, 1500),
      lastPurchaseDays: randomInt(1, 60),
      createdDays: randomInt(90, 365),
      tags: ['Regular', randomElement(['Vegetables', 'Houseplants', 'Roses']), 'Workshop-Attendee']
    };
  }
  
  // Seasonal Shopper (25%)
  if (ratio < 0.60) {
    return {
      segment: 'Seasonal Shopper',
      lifetimeValue: randomFloat(100, 500),
      totalSpent: randomFloat(75, 400),
      lastPurchaseDays: randomInt(30, 120),
      createdDays: randomInt(120, 500),
      tags: ['Occasional', randomElement(['Spring-Buyer', 'Summer-Buyer', 'Fall-Buyer']), 'Homeowner']
    };
  }
  
  // New Customer (20%)
  if (ratio < 0.80) {
    return {
      segment: 'New Customer',
      lifetimeValue: randomFloat(50, 300),
      totalSpent: randomFloat(50, 200),
      lastPurchaseDays: randomInt(1, 30),
      createdDays: randomInt(1, 30),
      tags: ['First-Time', 'Beginner Gardener', randomElement(['Annuals', 'Succulents'])]
    };
  }
  
  // Lapsed Customer (10%)
  if (ratio < 0.90) {
    return {
      segment: 'Lapsed Customer',
      lifetimeValue: randomFloat(200, 800),
      totalSpent: randomFloat(150, 600),
      lastPurchaseDays: randomInt(180, 365),
      createdDays: randomInt(365, 730),
      tags: ['Returning', randomElement(['Native-Plants', 'Tools']), 'Renter']
    };
  }
  
  // Professional/B2B (10%)
  return {
    segment: 'Professional/B2B',
    lifetimeValue: randomFloat(3000, 15000),
    totalSpent: randomFloat(2500, 12000),
    lastPurchaseDays: randomInt(1, 45),
    createdDays: randomInt(180, 730),
    tags: ['Professional', 'Business', 'Landscaper Pro', 'Loyalty-Member']
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, count = 500 } = await req.json();

    console.log(`[SeedDemo] Starting seed for user ${userId} with ${count} customers`);

    // Step 1: Create or get Plant Addicts tenant
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', 'plant-addicts')
      .maybeSingle();

    let tenantId: string;

    if (existingTenant) {
      tenantId = existingTenant.id;
      console.log(`[SeedDemo] Using existing tenant: ${tenantId}`);
    } else {
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: 'Plant Addicts',
          slug: 'plant-addicts',
          is_active: true,
          settings: {}
        })
        .select()
        .single();

      if (tenantError) throw tenantError;
      tenantId = newTenant.id;
      console.log(`[SeedDemo] Created new tenant: ${tenantId}`);
    }

    // Step 2: Assign user to tenant
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ tenant_id: tenantId })
      .eq('id', userId);

    if (userUpdateError) throw userUpdateError;
    console.log(`[SeedDemo] Assigned user to tenant`);

    // Step 3: Get existing personas from personas table
    const { data: existingPersonas, error: personasError } = await supabase
      .from('personas')
      .select('id');
    
    if (personasError) throw personasError;
    
    const personaIds = existingPersonas.map(p => p.id);
    console.log(`[SeedDemo] Found ${personaIds.length} personas`);

    // Step 4: Generate and insert customers in batches
    const batchSize = 50;
    let totalCreated = 0;
    const usedEmails = new Set<string>();

    for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
      const customers = [];
      const currentBatchSize = Math.min(batchSize, count - totalCreated);

      for (let i = 0; i < currentBatchSize; i++) {
        const globalIndex = totalCreated + i;
        const firstName = randomElement(firstNames);
        const lastName = randomElement(lastNames);
        
        // Generate unique email
        let email: string;
        let attempts = 0;
        do {
          email = generateEmail(firstName, lastName);
          attempts++;
        } while (usedEmails.has(email) && attempts < 10);
        
        if (usedEmails.has(email)) {
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}.${i}@${randomElement(emailDomains)}`;
        }
        usedEmails.add(email);

        const segment = generateCustomerSegment(globalIndex, count);
        const hasEmail = Math.random() < 0.85;
        const hasSms = Math.random() < 0.65;
        const emailOptInDate = segment.createdDays > 0 ? generateHistoricalDate(segment.createdDays - randomInt(0, 5)) : null;
        const smsOptInDate = hasSms && segment.createdDays > 0 ? generateHistoricalDate(segment.createdDays - randomInt(0, 10)) : null;

        customers.push({
          tenant_id: tenantId,
          user_id: userId,
          email: email,
          first_name: firstName,
          last_name: lastName,
          phone: Math.random() < 0.75 ? generatePhone() : null,
          persona_id: randomElement(personaIds),
          tags: segment.tags,
          lifetime_value: segment.lifetimeValue,
          total_spent: segment.totalSpent,
          last_purchase_date: generateHistoricalDate(segment.lastPurchaseDays),
          email_opt_in: hasEmail,
          email_opt_in_at: emailOptInDate,
          sms_opt_in: hasSms,
          sms_opt_in_at: smsOptInDate,
          timezone: randomElement(timezones),
          created_at: generateHistoricalDate(segment.createdDays)
        });
      }

      const { error: insertError } = await supabase
        .from('crm_customers')
        .insert(customers);

      if (insertError) {
        console.error(`[SeedDemo] Batch ${batch} insert error:`, insertError);
        throw insertError;
      }

      totalCreated += customers.length;
      console.log(`[SeedDemo] Inserted batch ${batch + 1}: ${totalCreated}/${count} customers`);
    }

    console.log(`[SeedDemo] Successfully created ${totalCreated} demo customers`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        personasCreated: personaIds.length,
        customersCreated: totalCreated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SeedDemo] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
