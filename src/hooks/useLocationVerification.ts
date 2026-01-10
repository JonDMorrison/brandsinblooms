import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { confirmLocationSelection, persistLocationExtraction } from '@/lib/location';

interface LocationData {
  postalCode?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: 'US' | 'CA' | null;
  source?: 'jsonld' | 'footer' | 'contact' | 'regex' | 'manual' | 'none' | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  snippet?: string | null;
  candidates?: any[];
  needsConfirmation?: boolean;
}

interface RedetectResult {
  success: boolean;
  hasNewCandidates: boolean;
  newCandidates?: any[];
  currentPostalCode?: string;
}

interface UseLocationVerificationReturn {
  locationData: LocationData | null;
  isLoading: boolean;
  isSaving: boolean;
  isRedetecting: boolean;
  fetchLocationData: () => Promise<void>;
  confirmLocation: (data: {
    postalCode: string;
    city?: string;
    stateProvince?: string;
    country?: 'US' | 'CA';
  }) => Promise<boolean>;
  redetectLocation: (websiteUrl: string) => Promise<RedetectResult>;
}

export const useLocationVerification = (): UseLocationVerificationReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedetecting, setIsRedetecting] = useState(false);

  const fetchLocationData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select(`
          postal_code,
          city,
          state_province,
          country,
          location_detection_source,
          location_confidence,
          location_detection_snippet,
          location_detection_candidates,
          location_needs_confirmation,
          website_url
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location data:', error);
        return;
      }

      if (data) {
        setLocationData({
          postalCode: data.postal_code,
          city: data.city,
          stateProvince: data.state_province,
          country: data.country as 'US' | 'CA' | null,
          source: data.location_detection_source as LocationData['source'],
          confidence: data.location_confidence as LocationData['confidence'],
          snippet: data.location_detection_snippet,
          candidates: data.location_detection_candidates as any[] || [],
          needsConfirmation: data.location_needs_confirmation || false,
        });
      }
    } catch (error) {
      console.error('Error in fetchLocationData:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const confirmLocation = useCallback(async (data: {
    postalCode: string;
    city?: string;
    stateProvince?: string;
    country?: 'US' | 'CA';
  }): Promise<boolean> => {
    if (!user?.id) return false;

    setIsSaving(true);
    try {
      const result = await confirmLocationSelection(
        user.id,
        data.postalCode,
        data.city,
        data.stateProvince,
        data.country
      );

      if (result.success) {
        toast({
          title: 'Location confirmed',
          description: 'Your business location has been saved.',
        });
        
        // Update local state
        setLocationData(prev => ({
          ...prev,
          postalCode: data.postalCode,
          city: data.city || prev?.city,
          stateProvince: data.stateProvince || prev?.stateProvince,
          country: data.country || prev?.country,
          source: 'manual',
          confidence: 'high',
          needsConfirmation: false,
        }));
        
        return true;
      } else {
        toast({
          title: 'Error saving location',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error confirming location:', error);
      toast({
        title: 'Error saving location',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, toast]);

  const redetectLocation = useCallback(async (websiteUrl: string): Promise<{
    success: boolean;
    hasNewCandidates: boolean;
    newCandidates?: any[];
    currentPostalCode?: string;
  }> => {
    if (!user?.id || !websiteUrl) {
      return { success: false, hasNewCandidates: false };
    }

    setIsRedetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      if (error) {
        toast({
          title: 'Detection failed',
          description: 'Could not analyze website for location.',
          variant: 'destructive',
        });
        return { success: false, hasNewCandidates: false };
      }

      if (data?.locationExtraction) {
        // NO forceOverwrite - this is a metadata-only refresh for confirmed locations
        const result = await persistLocationExtraction({
          userId: user.id,
          websiteUrl,
          locationExtraction: data.locationExtraction,
          forceOverwrite: false, // Never overwrite on re-detect
        });

        if (result.success) {
          // Check if there are new candidates different from current
          const newCandidates = data.locationExtraction.candidates || [];
          const hasNewCandidates = result.wasManuallyConfirmed && newCandidates.length > 0;
          
          if (!result.wasManuallyConfirmed) {
            toast({
              title: 'Location re-detected',
              description: result.needsConfirmation 
                ? 'Please confirm the detected location.'
                : 'Location updated successfully.',
            });
          } else {
            toast({
              title: 'Detection complete',
              description: 'Your confirmed location was preserved. New candidates are available if you want to change.',
            });
          }
          
          // Refresh data
          await fetchLocationData();
          
          return { 
            success: true, 
            hasNewCandidates,
            newCandidates,
            currentPostalCode: locationData?.postalCode || undefined
          };
        }
      }

      toast({
        title: 'No location found',
        description: 'Could not detect location from the website.',
        variant: 'destructive',
      });
      return { success: false, hasNewCandidates: false };
    } catch (error) {
      console.error('Error redetecting location:', error);
      toast({
        title: 'Detection error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return { success: false, hasNewCandidates: false };
    } finally {
      setIsRedetecting(false);
    }
  }, [user?.id, toast, fetchLocationData, locationData?.postalCode]);

  return {
    locationData,
    isLoading,
    isSaving,
    isRedetecting,
    fetchLocationData,
    confirmLocation,
    redetectLocation,
  };
};
