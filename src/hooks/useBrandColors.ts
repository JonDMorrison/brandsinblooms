import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
}

// Fallback colors if no brand colors are set
export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#22C55E',
  secondary: '#1E40AF',
  accent: '#F59E0B',
  text: '#1F2937',
  background: '#FFFFFF',
};

export function useBrandColors() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['brand-colors', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_BRAND_COLORS;

      const { data, error } = await supabase
        .from('company_profiles')
        .select('brand_primary_color, brand_secondary_color, brand_accent_color, brand_text_color')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_BRAND_COLORS;
      }

      return {
        primary: data.brand_primary_color || DEFAULT_BRAND_COLORS.primary,
        secondary: data.brand_secondary_color || DEFAULT_BRAND_COLORS.secondary,
        accent: data.brand_accent_color || DEFAULT_BRAND_COLORS.accent,
        text: data.brand_text_color || DEFAULT_BRAND_COLORS.text,
        background: DEFAULT_BRAND_COLORS.background,
      } as BrandColors;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Gets brand colors synchronously from cache or returns defaults.
 * Use this for form creation where we need immediate values.
 */
export async function fetchBrandColors(userId: string): Promise<BrandColors> {
  const { data, error } = await supabase
    .from('company_profiles')
    .select('brand_primary_color, brand_secondary_color, brand_accent_color, brand_text_color')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_BRAND_COLORS;
  }

  return {
    primary: data.brand_primary_color || DEFAULT_BRAND_COLORS.primary,
    secondary: data.brand_secondary_color || DEFAULT_BRAND_COLORS.secondary,
    accent: data.brand_accent_color || DEFAULT_BRAND_COLORS.accent,
    text: data.brand_text_color || DEFAULT_BRAND_COLORS.text,
    background: DEFAULT_BRAND_COLORS.background,
  };
}
