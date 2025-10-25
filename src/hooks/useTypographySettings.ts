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

      // Fetch current user's selected font
      if (user?.id) {
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select(`
            selected_font_id,
            selected_font:available_fonts(
              id,
              name,
              display_name,
              google_fonts_url,
              font_family_css,
              sort_order
            )
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.selected_font) {
          const font = profile.selected_font as any;
          setSelectedFont({
            id: font.id,
            name: font.name,
            displayName: font.display_name,
            googleFontsUrl: font.google_fonts_url,
            fontFamilyCss: font.font_family_css,
            sortOrder: font.sort_order
          });
        } else {
          // Default to Quicksand if no font selected
          const defaultFont = mappedFonts.find(f => f.name === 'quicksand');
          if (defaultFont) setSelectedFont(defaultFont);
        }
      }
    } catch (error) {
      console.error('Error loading fonts:', error);
      toast.error('Failed to load typography settings');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const saveFont = useCallback(async (fontId: string) => {
    if (!user?.id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('company_profiles')
        .update({ selected_font_id: fontId })
        .eq('user_id', user.id);

      if (error) throw error;

      const newFont = availableFonts.find(f => f.id === fontId);
      if (newFont) {
        setSelectedFont(newFont);
        toast.success('Typography settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving font:', error);
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
    isLoading,
    isSaving,
    saveFont
  };
};
