import { supabase } from '@/integrations/supabase/client';

/**
 * Test utility to verify OAuth configuration
 */
export const testOAuthSetup = async (): Promise<{
  success: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, any>;
}> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, any> = {};

  try {
    // Test 1: Check if get-oauth-config function works
    console.log('🧪 Testing OAuth config endpoint...');
    const { data: configData, error: configError } = await supabase.functions.invoke('get-oauth-config');
    
    if (configError) {
      errors.push(`OAuth config endpoint failed: ${configError.message}`);
    } else if (!configData?.success) {
      errors.push('OAuth config endpoint returned unsuccessful response');
    } else if (!configData?.clientId) {
      errors.push('No Facebook Client ID found in configuration');
    } else {
      info.clientIdExists = true;
      info.clientIdPrefix = configData.clientId.substring(0, 8) + '...';
      console.log('✅ OAuth config endpoint working');
    }

    // Test 2: Check current domain
    const currentDomain = window.location.origin;
    info.currentDomain = currentDomain;
    info.redirectUri = `${currentDomain}/auth/callback`;
    
    if (currentDomain.includes('localhost')) {
      errors.push('Running on localhost - Facebook OAuth will not work. Use the Lovable preview domain instead.');
    } else if (!currentDomain.includes('lovable.app') && !currentDomain.includes('brandsinblooms.com')) {
      warnings.push(`Unknown domain: ${currentDomain}. Make sure this is whitelisted in Facebook app settings.`);
    }

    // Test 3: Check for stale OAuth state
    const staleState = sessionStorage.getItem('oauth_state') || localStorage.getItem('oauth_state_backup');
    if (staleState) {
      warnings.push('Found stale OAuth state in browser storage - this will be cleared on next connection attempt');
      info.hasStaleState = true;
    }

    // Test 4: Test exchange-oauth-code with dummy data (should fail gracefully)
    console.log('🧪 Testing OAuth exchange endpoint...');
    const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke('exchange-oauth-code', {
      body: { code: 'test', state: 'test', redirect_uri: 'test' }
    });
    
    if (exchangeError?.message?.includes('Authorization header required')) {
      console.log('✅ OAuth exchange endpoint is properly secured');
      info.exchangeEndpointSecured = true;
    } else if (exchangeData?.error?.includes('Authorization code is required')) {
      console.log('✅ OAuth exchange endpoint is working and validating input');
      info.exchangeEndpointWorking = true;
    } else {
      warnings.push('OAuth exchange endpoint response was unexpected - check logs');
    }

    console.log('🧪 OAuth setup test completed');
    return {
      success: errors.length === 0,
      errors,
      warnings,
      info
    };

  } catch (error) {
    console.error('🧪 OAuth setup test failed with exception:', error);
    errors.push(`Test failed with exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      errors,
      warnings,
      info
    };
  }
};

/**
 * Clear all OAuth-related browser storage
 */
export const clearOAuthStorage = (): void => {
  console.log('🧹 Clearing OAuth browser storage...');
  
  // Session storage
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('oauth_state_uuid');
  sessionStorage.removeItem('oauth_state_timestamp');
  sessionStorage.removeItem('oauth_just_completed');
  sessionStorage.removeItem('processed_oauth_codes');
  sessionStorage.removeItem('social_connection_success');
  
  // Local storage
  localStorage.removeItem('oauth_state_backup');
  localStorage.removeItem('oauth_debug');
  localStorage.removeItem('oauth_mount_debug');
  
  console.log('✅ OAuth storage cleared');
};

/**
 * Generate a test redirect URI for the current environment
 */
export const getTestRedirectUri = (): string => {
  return `${window.location.origin}/auth/callback`;
};

/**
 * Check if current environment is suitable for OAuth testing
 */
export const isOAuthTestEnvironment = (): boolean => {
  const origin = window.location.origin;
  return !origin.includes('localhost') && 
         (origin.includes('lovable.app') || origin.includes('brandsinblooms.com'));
};