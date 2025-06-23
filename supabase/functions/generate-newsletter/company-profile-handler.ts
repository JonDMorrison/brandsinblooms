
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import type { CompanyProfile } from './prompt-builder.ts';

export const fetchCompanyProfile = async (
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<CompanyProfile | null> => {
  if (!userId) return null;

  try {
    const { data: profileData, error: profileError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError || !profileData) {
      console.log('No company profile found or error:', profileError?.message);
      return null;
    }

    return profileData as CompanyProfile;
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return null;
  }
};
