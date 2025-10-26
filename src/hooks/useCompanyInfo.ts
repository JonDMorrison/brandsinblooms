import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  emailDomain?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  selectedFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  headlineFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  subheadingFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  bodyFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
  buttonFont?: {
    id: string;
    name: string;
    displayName: string;
    googleFontsUrl: string;
    fontFamilyCss: string;
  };
}

export const useCompanyInfo = () => {
  const { user, loading } = useAuth();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'Your Company',
    address: '123 Business St, Suite 100, City, State 12345',
    phone: '(555) 123-4567',
  });
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  const loadCompanyInfo = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: profile, error } = await supabase
        .from('company_profiles')
        .select(`
          *,
          selected_font:available_fonts!selected_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          headline_font:available_fonts!headline_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          subheading_font:available_fonts!subheading_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          body_font:available_fonts!body_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          ),
          button_font:available_fonts!button_font_id(
            id,
            name,
            display_name,
            google_fonts_url,
            font_family_css
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading company profile:', error);
        return;
      }

      if (profile) {
        const featureFlags = profile.feature_flags as any;
        const font = profile.selected_font as any;
        const headlineFont = profile.headline_font as any;
        const subheadingFont = profile.subheading_font as any;
        const bodyFont = profile.body_font as any;
        const buttonFont = profile.button_font as any;
        
        setCompanyInfo({
          name: profile.company_name || 'Your Company',
          address: profile.location_info || '123 Business St, Suite 100, City, State 12345',
          phone: featureFlags?.company_phone || '(555) 123-4567',
          logoUrl: featureFlags?.company_logo_url,
          emailDomain: profile.email_domain,
          brandPrimaryColor: profile.brand_primary_color || '#22c55e',
          brandSecondaryColor: profile.brand_secondary_color || '#1e40af',
          brandAccentColor: profile.brand_accent_color || '#f59e0b',
          selectedFont: font ? {
            id: font.id,
            name: font.name,
            displayName: font.display_name,
            googleFontsUrl: font.google_fonts_url,
            fontFamilyCss: font.font_family_css
          } : undefined,
          headlineFont: headlineFont ? {
            id: headlineFont.id,
            name: headlineFont.name,
            displayName: headlineFont.display_name,
            googleFontsUrl: headlineFont.google_fonts_url,
            fontFamilyCss: headlineFont.font_family_css
          } : undefined,
          subheadingFont: subheadingFont ? {
            id: subheadingFont.id,
            name: subheadingFont.name,
            displayName: subheadingFont.display_name,
            googleFontsUrl: subheadingFont.google_fonts_url,
            fontFamilyCss: subheadingFont.font_family_css
          } : undefined,
          bodyFont: bodyFont ? {
            id: bodyFont.id,
            name: bodyFont.name,
            displayName: bodyFont.display_name,
            googleFontsUrl: bodyFont.google_fonts_url,
            fontFamilyCss: bodyFont.font_family_css
          } : undefined,
          buttonFont: buttonFont ? {
            id: buttonFont.id,
            name: buttonFont.name,
            displayName: buttonFont.display_name,
            googleFontsUrl: buttonFont.google_fonts_url,
            fontFamilyCss: buttonFont.font_family_css
          } : undefined
        });
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCompanyInfo();
  }, [loadCompanyInfo]);

  // Separate effect for real-time subscription to avoid dependency issues
  useEffect(() => {
    // Guard: Only proceed if user has an ID and auth is not loading
    if (!user?.id || loading) return;

    // Cleanup any existing subscription first
    const cleanupChannel = async () => {
      if (channelRef.current && isSubscribedRef.current) {
        console.log('🧹 Cleaning up existing subscription for user:', user.id);
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };

    // Setup new subscription
    const setupChannel = async () => {
      console.log('🔔 Setting up subscription for user:', user.id);
      await cleanupChannel();

      const channel = supabase
        .channel(`company-profile-changes-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'company_profiles',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📄 Company profile updated:', payload);
            // Reload company info to get updated font data
            loadCompanyInfo();
          }
        )
        .subscribe();

      channelRef.current = channel;
      isSubscribedRef.current = true;
    };

    setupChannel();

    return () => {
      cleanupChannel();
    };
  }, [user?.id, loading]);

  return useMemo(() => ({
    companyInfo,
    isLoading
  }), [companyInfo, isLoading]);
};