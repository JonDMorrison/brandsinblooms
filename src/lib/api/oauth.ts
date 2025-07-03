import { supabase } from '@/integrations/supabase/client';

export interface OAuthConfig {
  provider: string;
  clientId: string;
  success: boolean;
}

export const fetchOAuthConfig = async (): Promise<OAuthConfig> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-oauth-config');
    
    if (error) {
      console.error('❌ OAuth config fetch error:', error);
      throw new Error(`OAuth config failed: ${error.message}`);
    }
    
    if (!data?.success || !data?.clientId) {
      console.error('❌ Invalid OAuth config response:', data);
      throw new Error('Invalid OAuth configuration received');
    }
    
    console.log('✅ OAuth config fetched successfully');
    return data as OAuthConfig;
  } catch (error) {
    console.error('❌ fetchOAuthConfig failed:', error);
    throw error;
  }
};