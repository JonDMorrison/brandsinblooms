
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, AlertTriangle } from 'lucide-react';
// Removed sonner import - using global toast replacement

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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-primary/5 to-primary/10 border border-primary/20 shadow-xl backdrop-blur-sm">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 text-4xl">⚡</div>
        <div className="absolute bottom-4 left-4 text-3xl">💎</div>
      </div>
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shadow-sm">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Post Credits
              </h3>
              <p className="text-xs text-text-tertiary">
                Your monthly allowance
              </p>
            </div>
          </div>
          
          {/* Floating Credit Display */}
          <div className={`px-4 py-2 rounded-xl backdrop-blur-sm shadow-lg border transition-all duration-300 ${
            isLow 
              ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200/50 animate-pulse' 
              : 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20'
          }`}>
            <div className="text-center">
              <div className={`text-xl font-bold ${
                isLow ? 'text-red-600' : 'bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent'
              }`}>
                {tokenData.balance}
              </div>
              <div className="text-xs text-text-tertiary">
                of {tokenData.maxTokens}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="space-y-4">
          <div className="relative">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  isLow 
                    ? 'bg-gradient-to-r from-red-400 to-orange-400 shadow-lg shadow-red-200' 
                    : 'bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            {/* Progress Indicator */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-700 ${
                isLow 
                  ? 'bg-gradient-to-r from-red-400 to-orange-400' 
                  : 'bg-gradient-to-r from-primary to-primary/80'
              }`}
              style={{ left: `calc(${percentage}% - 8px)` }}
            />
          </div>

          {/* Reset Date */}
          {tokenData.resetAt && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Credits reset</span>
              <span className="font-medium text-text-secondary bg-white/50 px-2 py-1 rounded-md">
                {new Date(tokenData.resetAt).toLocaleDateString()}
              </span>
            </div>
          )}
          
          {/* Low Credits Warning */}
          {isLow && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-red-700 font-medium">
                Running low on credits! Consider upgrading your plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
