import { createClient } from '@supabase/supabase-js';

// Test API helpers for E2E tests
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found, E2E tests may not work properly');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Create a test persona
 */
export async function createTestPersona(tenantId, userId, name = 'Test Persona') {
  const { data, error } = await supabaseAdmin
    .from('crm_personas')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      persona_name: name,
      persona_description: `Automated test persona: ${name}`,
      is_custom: true
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create a test customer
 */
export async function createTestCustomer(tenantId, userId, email, personaId = null) {
  const { data, error } = await supabaseAdmin
    .from('crm_customers')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      email,
      first_name: 'Test',
      last_name: 'Customer',
      persona_id: personaId
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Clean up test data
 */
export async function cleanupTestData(personaIds = [], customerIds = []) {
  // Delete customers first (foreign key constraints)
  if (customerIds.length > 0) {
    const { error: customerError } = await supabaseAdmin
      .from('crm_customers')
      .delete()
      .in('id', customerIds);
    
    if (customerError) console.error('Error cleaning up customers:', customerError);
  }
  
  // Delete personas
  if (personaIds.length > 0) {
    const { error: personaError } = await supabaseAdmin
      .from('crm_personas')
      .delete()
      .in('id', personaIds);
    
    if (personaError) console.error('Error cleaning up personas:', personaError);
  }
}

/**
 * Get test user tenant info
 */
export async function getTestUserTenant(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}