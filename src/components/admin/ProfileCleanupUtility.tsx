
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Removed sonner import - using global toast replacement
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

export const ProfileCleanupUtility = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  const checkForDuplicates = async () => {
    if (!user) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('get_duplicate_merge_suggestions');
      
      if (error) {
        console.error('Error checking duplicates:', error);
        toast.error('Failed to check for duplicates');
        return;
      }
      
      setDuplicates(data || []);
      
      if (!data || data.length === 0) {
        toast.success('No duplicate accounts found');
      } else {
        toast.info(`Found ${data.length} sets of duplicate accounts`);
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      toast.error('Failed to check for duplicates');
    } finally {
      setChecking(false);
    }
  };

  const mergeDuplicates = async (keepUserId: string, mergeUserId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('merge_duplicate_accounts', {
        keep_user_id: keepUserId,
        merge_user_id: mergeUserId
      });
      
      if (error) {
        console.error('Error merging accounts:', error);
        toast.error('Failed to merge accounts');
        return;
      }
      
      toast.success('Accounts merged successfully');
      // Refresh the duplicates list
      await checkForDuplicates();
      
      // If this was the current user, reload the page to refresh all data
      if (keepUserId === user?.id || mergeUserId === user?.id) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Error merging accounts:', error);
      toast.error('Failed to merge accounts');
    } finally {
      setLoading(false);
    }
  };

  // Check if current user has duplicates
  const currentUserDuplicate = duplicates.find(dup => 
    dup.accounts.some((acc: any) => acc.user_id === user?.id)
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Profile Cleanup Utility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={checkForDuplicates}
            disabled={checking}
            variant="outline"
          >
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              'Check for Duplicates'
            )}
          </Button>
        </div>

        {currentUserDuplicate && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-800">
                  Duplicate Profiles Detected for Your Account
                </h4>
                <p className="text-sm text-orange-700 mt-1">
                  You have {currentUserDuplicate.accounts.length} profiles. 
                  This can cause issues with the app. We recommend merging them.
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  Suggested action: {currentUserDuplicate.suggestion_reason}
                </p>
                
                <div className="mt-3 space-y-2">
                  {currentUserDuplicate.accounts.map((account: any, index: number) => (
                    <div key={account.user_id} className="text-xs bg-white p-2 rounded border">
                      <div className="flex justify-between items-center">
                        <span>
                          Profile {index + 1}: {account.company_name || 'Unnamed'} 
                          ({account.tokens_balance} tokens)
                        </span>
                        {account.user_id === currentUserDuplicate.suggested_keep_user_id && (
                          <span className="text-green-600 font-medium">Recommended</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    const accounts = currentUserDuplicate.accounts;
                    const keepUserId = currentUserDuplicate.suggested_keep_user_id;
                    const mergeUserId = accounts.find((acc: any) => acc.user_id !== keepUserId)?.user_id;
                    
                    if (keepUserId && mergeUserId) {
                      mergeDuplicates(keepUserId, mergeUserId);
                    }
                  }}
                  disabled={loading}
                  className="mt-3"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    'Merge Profiles'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {duplicates.length === 0 && !checking && (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Click "Check for Duplicates" to scan for duplicate profiles
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
