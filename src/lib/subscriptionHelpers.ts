
import { supabase } from '@/integrations/supabase/client';

export async function isBloomEligible(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, end_date')
      .eq('user_id', userId)
      .single();

    if (error || !data) return false;
    
    // Bloom plan is always eligible
    if (data.plan === 'bloom') return true;
    
    // Free trial is eligible if still active
    if (data.plan === 'free_trial') {
      return data.end_date && new Date(data.end_date) > new Date();
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Bloom eligibility:', error);
    return false;
  }
}
