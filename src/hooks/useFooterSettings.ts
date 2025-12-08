import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NewsletterFooterProps } from '@/types/newsletterFooter';

export interface FooterSettings {
  // Display toggles
  showPhone: boolean;
  showLogo: boolean;
  showManagePreferences: boolean;
  showDivider: boolean;
  
  // Layout
  padding: 'compact' | 'normal' | 'spacious';
  alignment: 'left' | 'center';
  fontSize: 'xs' | 'sm';
  
  // Colors (legacy - kept for backward compatibility)
  backgroundColor: 'light' | 'dark' | 'white';
  
  // Text content
  complianceText: string;
  customFooterText?: string;
  
  // Social URLs
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  
  // Address fields
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  websiteUrl?: string;
}

const defaultFooterSettings: FooterSettings = {
  showPhone: true,
  showLogo: true,
  showManagePreferences: true,
  padding: 'normal',
  alignment: 'center',
  showDivider: true,
  backgroundColor: 'dark',
  fontSize: 'xs',
  complianceText: 'You are receiving this email because you opted in at {{company.name}}. If you no longer wish to receive these emails, you can unsubscribe at any time.',
};

export interface CampaignFooterOverrides {
  footerBackgroundColor?: string;
}

export const useFooterSettings = (campaignId?: string) => {
  const [footerSettings, setFooterSettingsState] = useState<FooterSettings>(defaultFooterSettings);
  const [campaignOverrides, setCampaignOverrides] = useState<CampaignFooterOverrides>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load footer settings from company profile
  useEffect(() => {
    const loadFooterSettings = async () => {
      try {
        setIsLoading(true);
        
        // Get user's company profile
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('*')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading company profile:', error);
          return;
        }

        if (profile) {
          const featureFlags = profile.feature_flags as any;
          const savedSettings = featureFlags?.footer_settings as FooterSettings;
          
          // Merge saved settings with address info from profile
          const mergedSettings: FooterSettings = {
            ...defaultFooterSettings,
            ...savedSettings,
            // Pull address from location_info if not separately stored
            websiteUrl: profile.website_url || savedSettings?.websiteUrl,
          };
          
          setFooterSettingsState(mergedSettings);
        }
      } catch (error) {
        console.error('Error loading footer settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFooterSettings();
  }, []);

  // Load campaign-specific footer overrides
  useEffect(() => {
    const loadCampaignOverrides = async () => {
      if (!campaignId) {
        setCampaignOverrides({});
        return;
      }
      
      try {
        const { data: campaign, error } = await supabase
          .from('crm_campaigns')
          .select('metadata')
          .eq('id', campaignId)
          .single();

        if (error) {
          console.error('Error loading campaign overrides:', error);
          return;
        }

        const metadata = campaign?.metadata as any;
        setCampaignOverrides({
          footerBackgroundColor: metadata?.footerBackgroundColor,
        });
      } catch (error) {
        console.error('Error loading campaign footer overrides:', error);
      }
    };

    loadCampaignOverrides();
  }, [campaignId]);

  // Save footer settings to company profile
  const saveFooterSettings = useCallback(async (settings: FooterSettings) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Get current feature_flags and merge with new footer settings
      const { data: currentProfile } = await supabase
        .from('company_profiles')
        .select('feature_flags')
        .eq('user_id', user.user.id)
        .single();

      const currentFlags = (currentProfile?.feature_flags as any) || {};
      
      const { error } = await supabase
        .from('company_profiles')
        .update({
          feature_flags: {
            ...currentFlags,
            footer_settings: settings
          }
        })
        .eq('user_id', user.user.id);

      if (error) {
        console.error('Error saving footer settings:', error);
        throw error;
      }

      setFooterSettingsState(settings);
    } catch (error) {
      console.error('Failed to save footer settings:', error);
      throw error;
    }
  }, []);

  // Save campaign-level footer override
  const saveCampaignFooterOverride = useCallback(async (
    campaignIdToUpdate: string,
    overrides: CampaignFooterOverrides
  ) => {
    try {
      // Get current campaign metadata
      const { data: campaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('metadata')
        .eq('id', campaignIdToUpdate)
        .single();

      if (fetchError) throw fetchError;

      const currentMetadata = (campaign?.metadata as any) || {};
      
      const { error } = await supabase
        .from('crm_campaigns')
        .update({
          metadata: {
            ...currentMetadata,
            ...overrides,
          }
        })
        .eq('id', campaignIdToUpdate);

      if (error) throw error;

      setCampaignOverrides(overrides);
    } catch (error) {
      console.error('Failed to save campaign footer override:', error);
      throw error;
    }
  }, []);

  // Clear campaign footer override (reset to brand default)
  const clearCampaignFooterOverride = useCallback(async (campaignIdToUpdate: string) => {
    try {
      const { data: campaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('metadata')
        .eq('id', campaignIdToUpdate)
        .single();

      if (fetchError) throw fetchError;

      const currentMetadata = (campaign?.metadata as any) || {};
      delete currentMetadata.footerBackgroundColor;
      
      const { error } = await supabase
        .from('crm_campaigns')
        .update({ metadata: currentMetadata })
        .eq('id', campaignIdToUpdate);

      if (error) throw error;

      setCampaignOverrides({});
    } catch (error) {
      console.error('Failed to clear campaign footer override:', error);
      throw error;
    }
  }, []);

  return {
    footerSettings,
    setFooterSettings: saveFooterSettings,
    campaignOverrides,
    saveCampaignFooterOverride,
    clearCampaignFooterOverride,
    isLoading
  };
};

/**
 * Build NewsletterFooterProps from various data sources
 * Always uses fresh companyInfo data for contact/address information
 */
export function buildFooterProps(
  footerSettings: FooterSettings,
  companyInfo: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    websiteUrl?: string;
    streetAddress?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
    logoUrl?: string;
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    pinterestUrl?: string;
    youtubeUrl?: string;
    linkedinUrl?: string;
    footerLegalText?: string;
  },
  unsubscribeUrl: string,
  managePreferencesUrl?: string,
  campaignOverrides?: CampaignFooterOverrides
): NewsletterFooterProps {
  // Always use fresh companyInfo data, with footerSettings overrides as fallback
  // This ensures changes in Contact & Footer Settings are reflected immediately
  const addressLine1 = companyInfo.streetAddress || footerSettings.addressLine1 || companyInfo.address;
  const city = companyInfo.city || footerSettings.city;
  const region = companyInfo.stateProvince || footerSettings.region;
  const postalCode = companyInfo.postalCode || footerSettings.postalCode;
  const country = companyInfo.country || footerSettings.country;
  const email = companyInfo.email || footerSettings.email;
  const websiteUrl = companyInfo.websiteUrl || footerSettings.websiteUrl;
  const phone = companyInfo.phone || '';
  
  // Use social URLs from companyInfo (fresh data from Contact & Footer Settings)
  const facebookUrl = companyInfo.facebookUrl || footerSettings.facebookUrl;
  const instagramUrl = companyInfo.instagramUrl || footerSettings.instagramUrl;
  const tiktokUrl = companyInfo.tiktokUrl || footerSettings.tiktokUrl;
  const pinterestUrl = companyInfo.pinterestUrl || footerSettings.pinterestUrl;
  const youtubeUrl = companyInfo.youtubeUrl || footerSettings.youtubeUrl;
  const linkedinUrl = companyInfo.linkedinUrl || footerSettings.linkedinUrl;
  
  // Use legal text from companyInfo if available
  const legalText = companyInfo.footerLegalText || footerSettings.complianceText;
  
  return {
    logoUrl: footerSettings.showLogo ? companyInfo.logoUrl : undefined,
    companyName: companyInfo.name,
    addressLine1,
    addressLine2: footerSettings.addressLine2,
    city,
    region,
    postalCode,
    country,
    websiteUrl,
    email,
    phone: footerSettings.showPhone ? phone : undefined,
    facebookUrl,
    instagramUrl,
    tiktokUrl,
    pinterestUrl,
    youtubeUrl,
    linkedinUrl,
    unsubscribeUrl,
    managePreferencesUrl: footerSettings.showManagePreferences ? managePreferencesUrl : undefined,
    legalText,
    footerBackgroundColor: campaignOverrides?.footerBackgroundColor,
    brandPrimaryColor: companyInfo.brandPrimaryColor,
    brandSecondaryColor: companyInfo.brandSecondaryColor,
  };
}
