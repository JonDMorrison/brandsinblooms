import React, { useCallback, useEffect, useRef, useState } from 'react';
import Stack from '@mui/joy/Stack';
import { CompanyProfileForm } from '@/components/CompanyProfileForm';
import { LocationVerificationCard } from '@/components/location/LocationVerificationCard';
import { ClimateProfileCard } from '@/components/location/ClimateProfileCard';
import { PageContainer } from '@/components/joy/PageContainer';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { useClimateProfile } from '@/hooks/useClimateProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const CompanyInformationTab = () => {
  const { user } = useAuth();
  const hasResolvedInitialProfileLoadRef = useRef(false);
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
    isLoading: isClimateLoading,
    isRefreshing: isRefreshingClimate,
    fetchClimateProfile,
    refreshClimateProfile,
  } = useClimateProfile();

  // Memoize the fetch function to prevent unnecessary re-renders
  const fetchProfile = useCallback(async () => {
    const isInitialLoad = !hasResolvedInitialProfileLoadRef.current;

    if (!user?.id) {
      if (isInitialLoad) {
        hasResolvedInitialProfileLoadRef.current = true;
        setIsLoading(false);
      }
      return;
    }

    try {
      if (isInitialLoad) {
        setIsLoading(true);
      }

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
      if (isInitialLoad) {
        hasResolvedInitialProfileLoadRef.current = true;
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
    fetchLocationData();
    fetchClimateProfile();
  }, [fetchProfile, fetchLocationData, fetchClimateProfile]);

  const handleToggleEdit = () => {
    setIsEditing((current) => !current);
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
  const hasPersistedProfile = Boolean(profile?.id);
  const shouldRenderSecondarySections = isLoading || hasPersistedProfile;
  const shouldRenderClimateSection =
    shouldRenderSecondarySections &&
    (isLoading || isLocationLoading || isClimateLoading || Boolean(showClimateCard));
  const shouldShowPageEmptyState = !isLoading && !isEditing && !hasPersistedProfile;

  if (shouldShowPageEmptyState) {
    return (
      <PageContainer>
        <CompanyProfileForm
          profile={profile}
          isEditing={isEditing}
          isLoading={false}
          onToggleEdit={handleToggleEdit}
          onProfileUpdate={handleProfileUpdate}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3}>
        <CompanyProfileForm
          profile={profile}
          isEditing={isEditing}
          isLoading={isLoading}
          onToggleEdit={handleToggleEdit}
          onProfileUpdate={handleProfileUpdate}
        />

        {shouldRenderSecondarySections ? (
        <LocationVerificationCard
          isLoading={isLoading || isLocationLoading}
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
        ) : null}

        {shouldRenderClimateSection ? (
        <ClimateProfileCard
          isLoading={isLoading || isLocationLoading || isClimateLoading}
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
        ) : null}
      </Stack>
    </PageContainer>
  );
};
