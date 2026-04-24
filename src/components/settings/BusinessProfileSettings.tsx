import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { CompanyProfileForm } from '@/components/CompanyProfileForm';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LocationVerificationCard } from '@/components/location';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { ClimateProfileCard } from '@/components/location/ClimateProfileCard';
import { useClimateProfile } from '@/hooks/useClimateProfile';

export const BusinessProfileSettings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    locationData,
    isLoading: isLocationLoading,
    isSaving,
    isRedetecting,
    fetchLocationData,
    confirmLocation,
    redetectLocation,
  } = useLocationVerification();

  const {
    climateProfile,
    isRefreshing: isRefreshingClimate,
    fetchClimateProfile,
    refreshClimateProfile,
  } = useClimateProfile();

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setIsLoading(false);
        return;
      }

      setProfile(data || null);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
    fetchLocationData();
    fetchClimateProfile();
  }, [fetchProfile, fetchLocationData, fetchClimateProfile]);

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleProfileUpdate = (updatedProfile: any) => {
    setProfile(updatedProfile);
    setIsEditing(false);
    // Refresh location and climate data in case it was updated
    fetchLocationData();
    fetchClimateProfile();
  };

  const handleLocationConfirm = async (data: {
    postalCode: string;
    city?: string;
    stateProvince?: string;
    country?: 'US' | 'CA';
  }) => {
    const success = await confirmLocation(data);
    if (success) {
      // Refresh profile and trigger climate derivation
      fetchProfile();
      // Automatically refresh climate profile after location confirmation
      await refreshClimateProfile(data.postalCode, data.country);
    }
  };

  const handleRedetect = async () => {
    if (profile?.website_url) {
      const result = await redetectLocation(profile.website_url);
      fetchProfile();
      return result;
    }
    return { success: false, hasNewCandidates: false };
  };

  const handleRefreshClimate = async () => {
    await refreshClimateProfile();
    fetchClimateProfile();
  };

  // Only show climate card if location is confirmed
  const showClimateCard = locationData?.postalCode && !locationData?.needsConfirmation;

  return (
    <div className="space-y-6">
      {/* Location Verification Card - shown prominently if needs confirmation */}
      {!isLoading && !isLocationLoading && (
        <LocationVerificationCard
          postalCode={locationData?.postalCode}
          city={locationData?.city}
          stateProvince={locationData?.stateProvince}
          country={locationData?.country}
          source={locationData?.source}
          confidence={locationData?.confidence}
          snippet={locationData?.snippet}
          candidates={locationData?.candidates}
          needsConfirmation={locationData?.needsConfirmation}
          onConfirm={handleLocationConfirm}
          onRedetect={profile?.website_url ? handleRedetect : undefined}
          isRedetecting={isRedetecting}
          isSaving={isSaving}
        />
      )}

      {/* Climate Profile Card - shown only when location is confirmed */}
      {!isLoading && showClimateCard && (
        <ClimateProfileCard
          climateArchetype={climateProfile?.climateArchetype}
          climateLabel={climateProfile?.climateLabel}
          climateConfidence={climateProfile?.climateConfidence}
          climateSource={climateProfile?.climateSource}
          climateLastUpdatedAt={climateProfile?.climateLastUpdatedAt}
          usdaZone={climateProfile?.usdaZone}
          firstFrostDate={climateProfile?.firstFrostDate}
          lastFrostDate={climateProfile?.lastFrostDate}
          onRefresh={handleRefreshClimate}
          isRefreshing={isRefreshingClimate}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Profile
          </CardTitle>
          <CardDescription>
            Manage your company information, brand voice, and target audience. This information is used to personalize your content generation and marketing campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading profile...</div>
            </div>
          ) : (
            <CompanyProfileForm 
              profile={profile}
              isEditing={isEditing}
              onToggleEdit={handleToggleEdit}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
