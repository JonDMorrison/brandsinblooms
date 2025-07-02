
import { supabase } from '@/integrations/supabase/client';

export async function isBloomEligible(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, end_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error checking Bloom eligibility:', error);
      return false;
    }
    
    if (!data || data.length === 0) return false;
    
    // Use the most recent subscription if multiple exist
    const subscription = data[0];
    
    // Bloom plan is always eligible
    if (subscription.plan === 'bloom') return true;
    
    // Free trial is eligible if still active
    if (subscription.plan === 'free_trial') {
      return subscription.end_date && new Date(subscription.end_date) > new Date();
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Bloom eligibility:', error);
    return false;
  }
}
