
import { supabase } from '@/integrations/supabase/client';

// List of test account emails that should have PRO access
const TEST_ACCOUNT_EMAILS = [
  'reviewer+test@brandsinblooms.com',
  'FB_TEST_USER_EMAIL'  // This will be replaced with actual test user email
];

export const isTestAccount = (email: string | undefined): boolean => {
  if (!email) return false;
  return TEST_ACCOUNT_EMAILS.includes(email.toLowerCase());
};

export const ensureTestAccountHasProAccess = async (userId: string, email: string) => {
  if (!isTestAccount(email)) return;

  try {
    // Check if test account already has a subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingSubscription) {
      // Create PRO subscription for test account
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(startDate.getFullYear() + 10); // 10 years

      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan: 'bloom', // Highest tier
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          billing_interval: 'annual'
        });

      if (error) {
        console.error('Error creating test account subscription:', error);
      } else {
        console.log('✅ Test account PRO access granted:', email);
      }
    }
  } catch (error) {
    console.error('Error ensuring test account PRO access:', error);
  }
};
