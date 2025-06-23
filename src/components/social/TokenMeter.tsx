
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';

export const TokenMeter = () => {
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState({
    balance: 0,
    resetAt: null,
    maxTokens: 200
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenData();
  }, [user]);

  const loadTokenData = async () => {
    if (!user) return;

    try {
      // Get token balance from company profile
      const { data: profile, error: profileError } = await supabase
        .from('company_profiles')
        .select('tokens_balance, tokens_reset_at')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get max tokens from subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('max_posts_per_month')
        .eq('user_id', user.id)
        .single();

      if (subError) throw subError;

      setTokenData({
        balance: profile?.tokens_balance || 0,
        resetAt: profile?.tokens_reset_at,
        maxTokens: subscription?.max_posts_per_month || 200
      });
    } catch (error) {
      console.error('Error loading token data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const percentage = Math.max(0, (tokenData.balance / tokenData.maxTokens) * 100);
  const isLow = percentage < 20;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5" />
          Post Credits
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Available credits</span>
            <span className={isLow ? 'text-red-600 font-medium' : ''}>
              {tokenData.balance} / {tokenData.maxTokens}
            </span>
          </div>
          <Progress 
            value={percentage} 
            className={`h-2 ${isLow ? '[&>div]:bg-red-500' : ''}`}
          />
          {tokenData.resetAt && (
            <p className="text-xs text-muted-foreground">
              Credits reset on {new Date(tokenData.resetAt).toLocaleDateString()}
            </p>
          )}
          {isLow && (
            <p className="text-xs text-red-600">
              Running low on credits! Consider upgrading your plan.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
