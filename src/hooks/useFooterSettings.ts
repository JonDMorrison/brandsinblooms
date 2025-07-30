import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FooterSettings {
  showPhone: boolean;
  showLogo: boolean;
  showManagePreferences: boolean;
  padding: 'compact' | 'normal' | 'spacious';
  alignment: 'left' | 'center';
  showDivider: boolean;
  backgroundColor: 'light' | 'dark' | 'white';
  fontSize: 'xs' | 'sm';
  complianceText: string;
  customFooterText?: string;
}

const defaultFooterSettings: FooterSettings = {
  showPhone: true,
  showLogo: false,
  showManagePreferences: true,
  padding: 'normal',
  alignment: 'center',
  showDivider: true,
  backgroundColor: 'light',
  fontSize: 'xs',
  complianceText: 'You are receiving this email because you opted in at {{company.name}}. If you no longer wish to receive these emails, you can unsubscribe at any time.',
};

export const useFooterSettings = (campaignId?: string) => {
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);
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
          // Extract footer settings from feature_flags or a separate field
          const featureFlags = profile.feature_flags as any;
          const savedSettings = featureFlags?.footer_settings as FooterSettings;
          if (savedSettings) {
            setFooterSettings({ ...defaultFooterSettings, ...savedSettings });
          }
        }
      } catch (error) {
        console.error('Error loading footer settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFooterSettings();
  }, []);

  // Save footer settings to company profile
  const saveFooterSettings = async (settings: FooterSettings) => {
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

      setFooterSettings(settings);
    } catch (error) {
      console.error('Failed to save footer settings:', error);
      throw error;
    }
  };

  return {
    footerSettings,
    setFooterSettings: saveFooterSettings,
    isLoading
  };
};