import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Font {
  id: string;
  name: string;
  displayName: string;
  googleFontsUrl: string;
  fontFamilyCss: string;
  sortOrder: number;
}

export const useTypographySettings = () => {
  const { user } = useAuth();
  const [availableFonts, setAvailableFonts] = useState<Font[]>([]);
  const [selectedFont, setSelectedFont] = useState<Font | null>(null);
  const [headlineFont, setHeadlineFont] = useState<Font | null>(null);
  const [subheadingFont, setSubheadingFont] = useState<Font | null>(null);
  const [bodyFont, setBodyFont] = useState<Font | null>(null);
  const [buttonFont, setButtonFont] = useState<Font | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadFonts = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch available fonts
      const { data: fonts, error: fontsError } = await supabase
        .from('available_fonts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (fontsError) throw fontsError;

      const mappedFonts = (fonts || []).map(font => ({
        id: font.id,
        name: font.name,
        displayName: font.display_name,
        googleFontsUrl: font.google_fonts_url,
        fontFamilyCss: font.font_family_css,
        sortOrder: font.sort_order
      }));

      setAvailableFonts(mappedFonts);

      // Fetch current user's selected fonts
      if (user?.id) {
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select(`
            selected_font_id,
            headline_font_id,
            subheading_font_id,
            body_font_id,
            button_font_id,
            selected_font:available_fonts!selected_font_id(id, name, display_name, google_fonts_url, font_family_css, sort_order),
            headline_font:available_fonts!headline_font_id(id, name, display_name, google_fonts_url, font_family_css, sort_order),
            subheading_font:available_fonts!subheading_font_id(id, name, display_name, google_fonts_url, font_family_css, sort_order),
            body_font:available_fonts!body_font_id(id, name, display_name, google_fonts_url, font_family_css, sort_order),
            button_font:available_fonts!button_font_id(id, name, display_name, google_fonts_url, font_family_css, sort_order)
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        // Auto-migrate: if user has selected_font but no granular fonts, copy it to all
        if (profile?.selected_font_id && 
            !profile.headline_font_id && 
            !profile.subheading_font_id && 
            !profile.body_font_id && 
            !profile.button_font_id) {
          await supabase
            .from('company_profiles')
            .update({
              headline_font_id: profile.selected_font_id,
              subheading_font_id: profile.selected_font_id,
              body_font_id: profile.selected_font_id,
              button_font_id: profile.selected_font_id
            })
            .eq('user_id', user.id);
          
          toast.info('Typography settings upgraded to granular controls');
        }

        const mapFont = (font: any): Font | null => {
          if (!font) return null;
          return {
            id: font.id,
            name: font.name,
            displayName: font.display_name,
            googleFontsUrl: font.google_fonts_url,
            fontFamilyCss: font.font_family_css,
            sortOrder: font.sort_order
          };
        };

        setSelectedFont(mapFont(profile?.selected_font));
        setHeadlineFont(mapFont(profile?.headline_font));
        setSubheadingFont(mapFont(profile?.subheading_font));
        setBodyFont(mapFont(profile?.body_font));
        setButtonFont(mapFont(profile?.button_font));
      }
    } catch (error) {
      console.error('Error loading fonts:', error);
      toast.error('Failed to load typography settings');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const saveTypographySettings = useCallback(async (settings: {
    headlineFontId?: string;
    subheadingFontId?: string;
    bodyFontId?: string;
    buttonFontId?: string;
  }) => {
    if (!user?.id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('company_profiles')
        .update({
          headline_font_id: settings.headlineFontId,
          subheading_font_id: settings.subheadingFontId,
          body_font_id: settings.bodyFontId,
          button_font_id: settings.buttonFontId,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      if (settings.headlineFontId) {
        const font = availableFonts.find(f => f.id === settings.headlineFontId);
        if (font) setHeadlineFont(font);
      }
      if (settings.subheadingFontId) {
        const font = availableFonts.find(f => f.id === settings.subheadingFontId);
        if (font) setSubheadingFont(font);
      }
      if (settings.bodyFontId) {
        const font = availableFonts.find(f => f.id === settings.bodyFontId);
        if (font) setBodyFont(font);
      }
      if (settings.buttonFontId) {
        const font = availableFonts.find(f => f.id === settings.buttonFontId);
        if (font) setButtonFont(font);
      }

      toast.success('Typography settings saved successfully');
    } catch (error) {
      console.error('Error saving typography:', error);
      toast.error('Failed to save typography settings');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, availableFonts]);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  return {
    availableFonts,
    selectedFont,
    headlineFont,
    subheadingFont,
    bodyFont,
    buttonFont,
    isLoading,
    isSaving,
    saveTypographySettings
  };
};
