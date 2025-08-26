import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';
import { clearOnboardingState, clearAllOnboardingFlags } from '@/utils/onboardingCleanup';
import { RefreshCw, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';

export const OnboardingHealth = () => {
  const { user } = useAuth();
  const { 
    isCompleted, 
    hasEverCompleted, 
    hasCheckedOnce, 
    isLoading, 
    error,
    refreshStatus 
  } = useOnboardingStatus();
  
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);
  const [sessionStorageKeys, setSessionStorageKeys] = useState<string[]>([]);

  // Scan storage for onboarding-related keys
  const scanStorage = () => {
    const localKeys = [];
    const sessionKeys = [];

    // Scan localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('onboarding') || 
        key.includes('dashboardTour') ||
        key.includes('garden-center-onboarding')
      )) {
        localKeys.push(key);
      }
    }

    // Scan sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('onboarding')) {
        sessionKeys.push(key);
      }
    }

    setLocalStorageKeys(localKeys);
    setSessionStorageKeys(sessionKeys);
  };

  // Get current company profile data (safe fields only)
  const getProfileSnapshot = async () => {
    if (!user) return null;
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('onboarding_completed_at, company_name, first_content_generated, created_at')
        .eq('user_id', user.id)
        .single();
      
      return profile;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  };

  const [profileSnapshot, setProfileSnapshot] = useState<any>(null);

  const refreshAll = async () => {
    scanStorage();
    await refreshStatus();
    const profile = await getProfileSnapshot();
    setProfileSnapshot(profile);
  };

  // Initialize on mount
  useState(() => {
    refreshAll();
  });

  if (!import.meta.env.DEV) {
    return (
      <div className="p-6">
        <p className="text-red-500">This page is only available in development mode.</p>
      </div>
    );
  }

  const StatusBadge = ({ condition, trueText, falseText }: { 
    condition: boolean; 
    trueText: string; 
    falseText: string; 
  }) => (
    <Badge variant={condition ? "default" : "secondary"} className="gap-1">
      {condition ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {condition ? trueText : falseText}
    </Badge>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Onboarding Health Check</h1>
          <p className="text-gray-600">Development-only diagnostic tool for onboarding state</p>
          <Button onClick={refreshAll} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>User ID:</strong> {user?.id || 'None'}</p>
              <p><strong>Email:</strong> {user?.email || 'None'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Context Status */}
        <Card>
          <CardHeader>
            <CardTitle>OnboardingStatusContext State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="font-medium">isCompleted</p>
                <StatusBadge condition={isCompleted} trueText="Complete" falseText="Incomplete" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">hasEverCompleted</p>
                <StatusBadge condition={hasEverCompleted} trueText="Ever Completed" falseText="Never Completed" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">hasCheckedOnce</p>
                <StatusBadge condition={hasCheckedOnce} trueText="Has Checked" falseText="Not Checked" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">isLoading</p>
                <StatusBadge condition={isLoading} trueText="Loading" falseText="Not Loading" />
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-700 font-medium">Error:</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Storage Flags */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                localStorage Keys
                <Button
                  onClick={() => {
                    clearAllOnboardingFlags();
                    scanStorage();
                  }}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {localStorageKeys.length === 0 ? (
                  <p className="text-gray-500">No onboarding keys found</p>
                ) : (
                  localStorageKeys.map(key => (
                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <code className="text-sm">{key}</code>
                      <div className="text-xs text-gray-500">
                        {localStorage.getItem(key)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>sessionStorage Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionStorageKeys.length === 0 ? (
                  <p className="text-gray-500">No onboarding keys found</p>
                ) : (
                  sessionStorageKeys.map(key => (
                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <code className="text-sm">{key}</code>
                      <div className="text-xs text-gray-500">
                        {sessionStorage.getItem(key)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Database Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Database Profile (Safe Fields)
              <Button
                onClick={async () => {
                  const profile = await getProfileSnapshot();
                  setProfileSnapshot(profile);
                }}
                variant="outline"
                size="sm"
              >
                <Clock className="w-4 h-4 mr-1" />
                Fetch Latest
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileSnapshot ? (
              <div className="space-y-2">
                <p><strong>Company Name:</strong> {profileSnapshot.company_name || 'Not set'}</p>
                <p><strong>Onboarding Completed At:</strong> {
                  profileSnapshot.onboarding_completed_at 
                    ? new Date(profileSnapshot.onboarding_completed_at).toLocaleString()
                    : 'Not completed'
                }</p>
                <p><strong>First Content Generated:</strong> {
                  profileSnapshot.first_content_generated ? 'Yes' : 'No'
                }</p>
                <p><strong>Profile Created:</strong> {
                  profileSnapshot.created_at
                    ? new Date(profileSnapshot.created_at).toLocaleString()
                    : 'Unknown'
                }</p>
              </div>
            ) : (
              <p className="text-gray-500">No profile data available</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => {
              if (user) clearOnboardingState(user.id);
              scanStorage();
            }}
            variant="outline"
          >
            Clear User-Specific Flags
          </Button>
          <Button
            onClick={() => {
              sessionStorage.removeItem('onboarding-completing');
              sessionStorage.removeItem('onboarding-checked');
              scanStorage();
            }}
            variant="outline"
          >
            Clear Session Flags
          </Button>
          <Button
            onClick={() => {
              clearAllOnboardingFlags();
              scanStorage();
            }}
            variant="destructive"
          >
            Nuclear Reset (All Flags)
          </Button>
        </div>
      </div>
    </div>
  );
};