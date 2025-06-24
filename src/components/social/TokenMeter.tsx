
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const TokenMeter = () => {
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState({
    balance: 0,
    resetAt: null,
    maxTokens: 200
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTokenData();
  }, [user]);

  const loadTokenData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('Loading token data for user:', user.id);
      
      // First, check for duplicate profiles and clean them up
      const { data: profiles, error: profilesError } = await supabase
        .from('company_profiles')
        .select('id, tokens_balance, tokens_reset_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        throw profilesError;
      }

      console.log(`Found ${profiles?.length || 0} profiles for user`);

      let profile;
      if (profiles && profiles.length > 1) {
        // Multiple profiles found - use the most recent one and log the issue
        console.warn(`Found ${profiles.length} profiles for user ${user.id}, using most recent`);
        toast.warning('Multiple profiles detected. Using most recent data.');
        profile = profiles[0]; // Most recent due to ordering
        
        // Optionally, you could trigger cleanup here
        // For now, we'll just use the most recent profile
      } else if (profiles && profiles.length === 1) {
        profile = profiles[0];
      } else {
        // No profile found - this might be a new user
        console.log('No company profile found for user');
        setTokenData({
          balance: 0,
          resetAt: null,
          maxTokens: 200
        });
        setLoading(false);
        return;
      }

      // Get max tokens from subscription - use maybeSingle to avoid errors if no subscription exists
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('max_posts_per_month')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError) {
        console.error('Error loading subscription:', subError);
        // Don't throw here - subscription might not exist yet
      }

      setTokenData({
        balance: profile?.tokens_balance || 0,
        resetAt: profile?.tokens_reset_at,
        maxTokens: subscription?.max_posts_per_month || 200
      });
    } catch (error) {
      console.error('Error loading token data:', error);
      setError('Failed to load token information');
      toast.error('Failed to load token information');
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
            <button 
              onClick={loadTokenData}
              className="text-xs text-blue-600 hover:underline mt-2"
            >
              Try again
            </button>
          </div>
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
