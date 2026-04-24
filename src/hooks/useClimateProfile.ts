import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface ClimateProfile {
  latitude: number | null;
  longitude: number | null;
  climateArchetype: string | null;
  climateLabel: string | null;
  climateConfidence: string | null;
  climateSource: string | null;
  climateLastUpdatedAt: string | null;
  usdaZone: string | null;
  firstFrostDate: string | null;
  lastFrostDate: string | null;
}

export const useClimateProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasResolvedInitialLoadRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [climateProfile, setClimateProfile] = useState<ClimateProfile | null>(null);

  const fetchClimateProfile = useCallback(async () => {
    const isInitialLoad = !hasResolvedInitialLoadRef.current;

    if (!user?.id) {
      setClimateProfile(null);

      if (isInitialLoad) {
        hasResolvedInitialLoadRef.current = true;
        setIsLoading(false);
      }

      return null;
    }

    if (isInitialLoad) {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select(`
          latitude, longitude, climate_archetype, climate_label,
          climate_confidence, climate_source, climate_last_updated_at,
          usda_zone, first_frost_date, last_frost_date
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching climate profile:', error);
        setClimateProfile(null);
        return null;
      }

      if (data) {
        const profile: ClimateProfile = {
          latitude: data.latitude,
          longitude: data.longitude,
          climateArchetype: data.climate_archetype,
          climateLabel: data.climate_label,
          climateConfidence: data.climate_confidence,
          climateSource: data.climate_source,
          climateLastUpdatedAt: data.climate_last_updated_at,
          usdaZone: data.usda_zone,
          firstFrostDate: data.first_frost_date,
          lastFrostDate: data.last_frost_date,
        };
        setClimateProfile(profile);
        return profile;
      }

      setClimateProfile(null);
      return null;
    } catch (error) {
      console.error('Error in fetchClimateProfile:', error);
      setClimateProfile(null);
      return null;
    } finally {
      if (isInitialLoad) {
        hasResolvedInitialLoadRef.current = true;
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  const refreshClimateProfile = useCallback(async (postalCode?: string, country?: string) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to refresh climate profile',
        variant: 'destructive',
      });
      return false;
    }

    setIsRefreshing(true);

    try {
      // Get postal code from profile if not provided
      let effectivePostalCode = postalCode;
      let effectiveCountry = country;

      if (!effectivePostalCode) {
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('postal_code, country')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile?.postal_code) {
          toast({
            title: 'Missing Location',
            description: 'Please confirm your postal code first before refreshing climate profile',
            variant: 'destructive',
          });
          return false;
        }

        effectivePostalCode = profile.postal_code;
        effectiveCountry = profile.country || 'US';
      }

      const { data, error } = await supabase.functions.invoke('derive-climate-profile', {
        body: {
          user_id: user.id,
          postal_code: effectivePostalCode,
          country: effectiveCountry || 'US',
          force_refresh: true,
        },
      });

      if (error) {
        console.error('Error refreshing climate profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to refresh climate profile. Please try again.',
          variant: 'destructive',
        });
        return false;
      }

      if (data?.success) {
        // Refetch to update local state
        await fetchClimateProfile();

        toast({
          title: 'Climate Profile Updated',
          description: data.climate_label 
            ? `Climate type: ${data.climate_label}`
            : 'Your climate profile has been updated',
        });
        return true;
      } else {
        toast({
          title: 'Warning',
          description: data?.message || 'Climate profile update completed with warnings',
          variant: 'default',
        });
        return false;
      }
    } catch (error) {
      console.error('Error in refreshClimateProfile:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, toast, fetchClimateProfile]);

  return {
    climateProfile,
    isLoading,
    isRefreshing,
    fetchClimateProfile,
    refreshClimateProfile,
  };
};
