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
  redetectLocation: (websiteUrl: string) => Promise<boolean>;
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

  const redetectLocation = useCallback(async (websiteUrl: string): Promise<boolean> => {
    if (!user?.id || !websiteUrl) return false;

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
        return false;
      }

      if (data?.locationExtraction) {
        const result = await persistLocationExtraction({
          userId: user.id,
          websiteUrl,
          locationExtraction: data.locationExtraction,
          forceOverwrite: true, // User explicitly requested re-detection
        });

        if (result.success) {
          toast({
            title: 'Location re-detected',
            description: result.needsConfirmation 
              ? 'Please confirm the detected location.'
              : 'Location updated successfully.',
          });
          
          // Refresh data
          await fetchLocationData();
          return true;
        }
      }

      toast({
        title: 'No location found',
        description: 'Could not detect location from the website.',
        variant: 'destructive',
      });
      return false;
    } catch (error) {
      console.error('Error redetecting location:', error);
      toast({
        title: 'Detection error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRedetecting(false);
    }
  }, [user?.id, toast, fetchLocationData]);

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
