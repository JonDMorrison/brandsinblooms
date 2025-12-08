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
 */
export function buildFooterProps(
  footerSettings: FooterSettings,
  companyInfo: {
    name?: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
  },
  unsubscribeUrl: string,
  managePreferencesUrl?: string,
  campaignOverrides?: CampaignFooterOverrides
): NewsletterFooterProps {
  // Parse address if it's a single string
  let addressLine1 = footerSettings.addressLine1;
  let city = footerSettings.city;
  let region = footerSettings.region;
  let postalCode = footerSettings.postalCode;
  let country = footerSettings.country;
  
  // If no structured address but companyInfo.address exists, use that
  if (!addressLine1 && companyInfo.address) {
    addressLine1 = companyInfo.address;
  }
  
  return {
    logoUrl: footerSettings.showLogo ? companyInfo.logoUrl : undefined,
    companyName: companyInfo.name,
    addressLine1,
    addressLine2: footerSettings.addressLine2,
    city,
    region,
    postalCode,
    country,
    websiteUrl: footerSettings.websiteUrl,
    email: footerSettings.email,
    phone: footerSettings.showPhone ? companyInfo.phone : undefined,
    facebookUrl: footerSettings.facebookUrl,
    instagramUrl: footerSettings.instagramUrl,
    tiktokUrl: footerSettings.tiktokUrl,
    pinterestUrl: footerSettings.pinterestUrl,
    youtubeUrl: footerSettings.youtubeUrl,
    linkedinUrl: footerSettings.linkedinUrl,
    unsubscribeUrl,
    managePreferencesUrl: footerSettings.showManagePreferences ? managePreferencesUrl : undefined,
    legalText: footerSettings.complianceText,
    footerBackgroundColor: campaignOverrides?.footerBackgroundColor,
    brandPrimaryColor: companyInfo.brandPrimaryColor,
    brandSecondaryColor: companyInfo.brandSecondaryColor,
  };
}
