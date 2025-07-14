
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface DuplicateAccount {
  user_id: string;
  created_at: string;
  onboarding_completed_at?: string;
  tokens_balance: number;
  company_name?: string;
  content_count: number;
  campaign_count: number;
}

interface DuplicateSuggestion {
  email: string;
  accounts: DuplicateAccount[];
  suggested_keep_user_id: string;
  suggestion_reason: string;
}

interface DatabaseDuplicateSuggestion {
  email: string;
  accounts: any; // This is the Json type from Supabase
  suggested_keep_user_id: string;
  suggestion_reason: string;
}

export const useDuplicateManagement = () => {
  const [loading, setLoading] = useState(false);
  const [mergingPair, setMergingPair] = useState<{keep: string, merge: string} | null>(null);

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_to_check: email
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const getDuplicateSuggestions = async (): Promise<DuplicateSuggestion[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_duplicate_merge_suggestions');

      if (error) throw error;
      
      // Transform the database response to match our TypeScript types
      const suggestions: DuplicateSuggestion[] = (data as DatabaseDuplicateSuggestion[] || []).map(item => ({
        email: item.email,
        accounts: Array.isArray(item.accounts) ? item.accounts as DuplicateAccount[] : [],
        suggested_keep_user_id: item.suggested_keep_user_id,
        suggestion_reason: item.suggestion_reason
      }));

      return suggestions;
    } catch (error) {
      console.error('Error fetching duplicate suggestions:', error);
      toast.error('Failed to fetch duplicate suggestions');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const mergeAccounts = async (keepUserId: string, mergeUserId: string): Promise<boolean> => {
    setMergingPair({keep: keepUserId, merge: mergeUserId});
    try {
      const { data, error } = await supabase.rpc('merge_duplicate_accounts', {
        keep_user_id: keepUserId,
        merge_user_id: mergeUserId
      });

      if (error) throw error;
      
      toast.success('Accounts merged successfully');
      return true;
    } catch (error) {
      console.error('Error merging accounts:', error);
      toast.error('Failed to merge accounts');
      return false;
    } finally {
      setMergingPair(null);
    }
  };

  return {
    loading,
    mergingPair,
    checkEmailExists,
    getDuplicateSuggestions,
    mergeAccounts
  };
};
