import { supabase } from '@/integrations/supabase/client';

export interface TenantValidationResult {
  isValid: boolean;
  tenantId: string | null;
  error?: string;
}

/**
 * Validates that a user has a valid tenant context assigned
 * CRITICAL: This prevents multi-tenant data isolation breaches
 */
export const validateTenantContext = async (userId: string): Promise<TenantValidationResult> => {
  try {
    console.log('🔍 [TENANT VALIDATION] Checking tenant context for user:', userId);
    
    const { data, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ [TENANT VALIDATION] Failed to fetch tenant context:', error);
      return {
        isValid: false,
        tenantId: null,
        error: `Database error: ${error.message}`
      };
    }

    if (!data) {
      console.error('❌ [TENANT VALIDATION] User not found:', userId);
      return {
        isValid: false,
        tenantId: null,
        error: 'User not found'
      };
    }

    if (!data.tenant_id) {
      console.error('❌ [TENANT VALIDATION] User has no tenant_id assigned:', userId);
      return {
        isValid: false,
        tenantId: null,
        error: 'No tenant assigned to user. Please contact support.'
      };
    }

    console.log('✅ [TENANT VALIDATION] Tenant context validated:', {
      userId,
      tenantId: data.tenant_id
    });
    
    return {
      isValid: true,
      tenantId: data.tenant_id
    };
  } catch (error) {
    console.error('❌ [TENANT VALIDATION] Exception during validation:', error);
    return {
      isValid: false,
      tenantId: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Validates that a campaign belongs to the user's tenant
 */
export const validateCampaignTenant = async (
  campaignId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (!userData?.tenant_id) {
      console.error('❌ [CAMPAIGN VALIDATION] User has no tenant');
      return false;
    }

    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('tenant_id')
      .eq('id', campaignId)
      .single();

    if (!campaignData) {
      console.error('❌ [CAMPAIGN VALIDATION] Campaign not found');
      return false;
    }

    const isValid = campaignData.tenant_id === userData.tenant_id;
    
    if (!isValid) {
      console.error('❌ [CAMPAIGN VALIDATION] Tenant mismatch:', {
        userTenant: userData.tenant_id,
        campaignTenant: campaignData.tenant_id
      });
    }

    return isValid;
  } catch (error) {
    console.error('❌ [CAMPAIGN VALIDATION] Exception:', error);
    return false;
  }
};
