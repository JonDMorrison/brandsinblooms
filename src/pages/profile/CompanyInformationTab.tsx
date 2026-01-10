import React, { useState, useEffect, useCallback } from 'react';
import { CompanyProfileForm } from '@/components/CompanyProfileForm';
import { LocationVerificationCard } from '@/components/location/LocationVerificationCard';
import { ClimateProfileCard } from '@/components/location/ClimateProfileCard';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { useClimateProfile } from '@/hooks/useClimateProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const CompanyInformationTab = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

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

  // Memoize the fetch function to prevent unnecessary re-renders
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
        setProfile(null);
        return;
      }

      setProfile(data || null);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      setProfile(null);
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

  const handleProfileUpdate = (updatedProfile) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Location Verification Card - shown prominently if needs confirmation */}
      {!isLocationLoading && (
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
      {showClimateCard && (
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

      <CompanyProfileForm 
        profile={profile}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        onProfileUpdate={handleProfileUpdate}
      />
    </div>
  );
};
