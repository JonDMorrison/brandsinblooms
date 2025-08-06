import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export interface GeoFilter {
  type: 'postal_code' | 'city' | 'state_region' | 'country_code' | 'usda_zone' | 'climate_zone' | 'radius';
  operator: 'equals' | 'contains' | 'in' | 'within_radius';
  value: string | string[];
  radius_km?: number;
  center_lat?: number;
  center_lon?: number;
}

export interface GeoSegmentEstimate {
  total_customers: number;
  sample_customers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    city: string;
    state_region: string;
    postal_code: string;
  }>;
}

export const useGeoSegmentation = () => {
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();

  const estimateGeoSegment = useCallback(async (filters: GeoFilter[]): Promise<GeoSegmentEstimate | null> => {
    if (!user || !tenant || filters.length === 0) return null;

    setEstimating(true);
    try {
      // For now, return a mock estimate
      // In production, this would build complex geo queries
      const mockEstimate = Math.floor(Math.random() * 500) + 50;
      
      return {
        total_customers: mockEstimate,
        sample_customers: [
          {
            id: '1',
            first_name: 'Sample',
            last_name: 'Customer',
            city: 'Portland',
            state_region: 'OR',
            postal_code: '97201'
          }
        ]
      };

    } catch (error) {
      console.error('Error estimating geo segment:', error);
      toast({
        title: "Error",
        description: "Failed to estimate segment reach",
        variant: "destructive"
      });
      return null;
    } finally {
      setEstimating(false);
    }
  }, [user, tenant, toast]);

  const enrichCustomerGeoData = useCallback(async (customerId: string, postalCode: string, countryCode: string = 'US') => {
    if (!user || !tenant) return false;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geo-enrichment', {
        body: {
          customer_id: customerId,
          postal_code: postalCode,
          country_code: countryCode
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer location data enriched successfully"
      });

      return true;
    } catch (error) {
      console.error('Error enriching geo data:', error);
      toast({
        title: "Error",
        description: "Failed to enrich location data",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, tenant, toast]);

  const batchEnrichGeoData = useCallback(async (limit: number = 50) => {
    if (!user || !tenant) return false;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geo-enrichment');

      if (error) throw error;

      toast({
        title: "Success",
        description: `Batch enrichment completed successfully`
      });

      return true;
    } catch (error) {
      console.error('Error in batch enrichment:', error);
      toast({
        title: "Error",
        description: "Failed to enrich customer data",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, tenant, toast]);

  return {
    loading,
    estimating,
    estimateGeoSegment,
    enrichCustomerGeoData,
    batchEnrichGeoData
  };
};