#!/usr/bin/env bun

/**
 * OAuth Environment Validation Script
 * 
 * Validates that all required OAuth environment variables and configurations
 * are properly set up for the Meta (Facebook/Instagram) integration.
 */

import { supabase } from '../src/integrations/supabase/client';

interface ValidationResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

async function validateOAuthEnvironment(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. Check if get-oauth-config edge function returns valid config
  try {
    console.log('🔍 Checking get-oauth-config edge function...');
    const { data, error } = await supabase.functions.invoke('get-oauth-config');
    
    if (error) {
      results.push({
        step: 'get-oauth-config',
        success: false,
        message: 'Failed to call get-oauth-config function',
        details: error
      });
    } else if (!data?.success || !data?.clientId) {
      results.push({
        step: 'get-oauth-config',
        success: false,
        message: 'get-oauth-config returned invalid response',
        details: data
      });
    } else {
      results.push({
        step: 'get-oauth-config',
        success: true,
        message: `Successfully retrieved Facebook Client ID: ${data.clientId.substring(0, 8)}...`,
        details: { clientId: data.clientId }
      });
    }
  } catch (error) {
    results.push({
      step: 'get-oauth-config',
      success: false,
      message: 'Exception calling get-oauth-config',
      details: error
    });
  }

  // 2. Check redirect URI configuration
  const expectedRedirectUri = `${window.location.origin}/auth/callback`;
  results.push({
    step: 'redirect-uri',
    success: true,
    message: `Redirect URI configured as: ${expectedRedirectUri}`,
    details: { redirectUri: expectedRedirectUri }
  });

  // 3. Validate social_connections table structure
  try {
    console.log('🔍 Checking social_connections table...');
    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      results.push({
        step: 'social_connections_table',
        success: false,
        message: 'Failed to query social_connections table',
        details: error
      });
    } else {
      results.push({
        step: 'social_connections_table',
        success: true,
        message: 'social_connections table is accessible',
        details: { tableAccessible: true }
      });
    }
  } catch (error) {
    results.push({
      step: 'social_connections_table',
      success: false,
      message: 'Exception checking social_connections table',
      details: error
    });
  }

  // 4. Check oauth_code_usage table
  try {
    console.log('🔍 Checking oauth_code_usage table...');
    const { data, error } = await supabase
      .from('oauth_code_usage')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      results.push({
        step: 'oauth_code_usage_table',
        success: false,
        message: 'Failed to query oauth_code_usage table',
        details: error
      });
    } else {
      results.push({
        step: 'oauth_code_usage_table',
        success: true,
        message: 'oauth_code_usage table is accessible',
        details: { tableAccessible: true }
      });
    }
  } catch (error) {
    results.push({
      step: 'oauth_code_usage_table',
      success: false,
      message: 'Exception checking oauth_code_usage table',
      details: error
    });
  }

  return results;
}

async function main() {
  console.log('🚀 Starting OAuth Environment Validation...\n');
  
  const results = await validateOAuthEnvironment();
  
  console.log('📊 Validation Results:');
  console.log('====================\n');
  
  let allPassed = true;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.step}: ${result.message}`);
    
    if (!result.success) {
      allPassed = false;
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
    }
    console.log('');
  }
  
  if (allPassed) {
    console.log('🎉 All OAuth environment checks passed!');
  } else {
    console.log('⚠️  Some OAuth environment checks failed. Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { validateOAuthEnvironment };