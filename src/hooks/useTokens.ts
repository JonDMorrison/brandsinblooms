
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Removed sonner import - using global toast replacement
import { TokenBalance, TokenUsage } from '@/types/tokens';
import { TOKEN_CONSTANTS } from '@/constants/tokens';
import { handleError, logError } from '@/utils/errorHandling';

export const useTokens = () => {
  const { user } = useAuth();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokenBalance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_token_balance', {
        p_user_id: user.id
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTokenBalance(data[0]);
      }
    } catch (error) {
      logError(error, 'fetchTokenBalance');
      handleError(error, 'token balance loading');
    }
  };

  const fetchTokenUsage = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTokenUsage(data || []);
    } catch (error) {
      logError(error, 'fetchTokenUsage');
    }
  };

  const spendTokens = async (
    tokens: number, 
    actionType: string = 'generation',
    contentType?: string,
    campaignId?: string
  ) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('spend_tokens', {
        p_user_id: user.id,
        p_tokens: tokens,
        p_action_type: actionType,
        p_content_type: contentType,
        p_campaign_id: campaignId
      });

      if (error) throw error;
      
      await fetchTokenBalance();
      await fetchTokenUsage();
      
      return data;
    } catch (error) {
      logError(error, 'spendTokens');
      handleError(error, 'token usage processing');
      return false;
    }
  };

  const checkTokenAvailability = (tokensNeeded: number) => {
    if (!tokenBalance) return false;
    return tokenBalance.tokens_balance >= tokensNeeded || tokenBalance.tokens_balance < 0;
  };

  const getOverageAmount = () => {
    if (!tokenBalance || tokenBalance.tokens_balance >= 0) return 0;
    return Math.abs(tokenBalance.tokens_balance);
  };

  const getOverageCost = () => {
    const overage = getOverageAmount();
    return overage * TOKEN_CONSTANTS.OVERAGE_RATE;
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchTokenBalance(), fetchTokenUsage()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user]);

  return {
    tokenBalance,
    tokenUsage,
    loading,
    spendTokens,
    checkTokenAvailability,
    getOverageAmount,
    getOverageCost,
    refetch: () => Promise.all([fetchTokenBalance(), fetchTokenUsage()])
  };
};
