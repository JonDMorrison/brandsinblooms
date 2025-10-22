import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, Save, RotateCcw } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Green Garden (Default)', primary: '#22c55e', secondary: '#1e40af', accent: '#f59e0b' },
  { name: 'Ocean Blue', primary: '#0ea5e9', secondary: '#1e3a8a', accent: '#06b6d4' },
  { name: 'Rose Garden', primary: '#f43f5e', secondary: '#be123c', accent: '#fda4af' },
  { name: 'Sunset Orange', primary: '#f97316', secondary: '#c2410c', accent: '#fed7aa' },
  { name: 'Purple Bloom', primary: '#a855f7', secondary: '#7e22ce', accent: '#e9d5ff' },
  { name: 'Forest Green', primary: '#16a34a', secondary: '#14532d', accent: '#86efac' },
];

const DEFAULT_COLORS = {
  primary: '#22c55e',
  secondary: '#1e40af',
  accent: '#f59e0b',
};

export const BrandColorsSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [colors, setColors] = useState(DEFAULT_COLORS);

  useEffect(() => {
    loadBrandColors();
  }, [user]);

  const loadBrandColors = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('company_profiles')
        .select('brand_primary_color, brand_secondary_color, brand_accent_color')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading brand colors:', error);
        return;
      }

      if (data) {
        setColors({
          primary: data.brand_primary_color || DEFAULT_COLORS.primary,
          secondary: data.brand_secondary_color || DEFAULT_COLORS.secondary,
          accent: data.brand_accent_color || DEFAULT_COLORS.accent,
        });
      }
    } catch (error) {
      console.error('Error loading brand colors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBrandColors = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('company_profiles')
        .update({
          brand_primary_color: colors.primary,
          brand_secondary_color: colors.secondary,
          brand_accent_color: colors.accent,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Brand colors saved',
        description: 'Your brand colors will be used in all new email campaigns.',
      });
    } catch (error) {
      console.error('Error saving brand colors:', error);
      toast({
        title: 'Error saving colors',
        description: 'Failed to save brand colors. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setColors({
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
    });
  };

  const resetToDefaults = () => {
    setColors(DEFAULT_COLORS);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Customize your brand colors for email campaigns and newsletters. These colors will be used for buttons, headers, and other design elements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  placeholder="#22c55e"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for CTA buttons and primary actions</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for headers and secondary elements</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={colors.accent}
                  onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.accent}
                  onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                  placeholder="#f59e0b"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used for highlights and accents</p>
            </div>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-6 space-y-4 bg-white">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold" style={{ color: colors.secondary }}>
                  Newsletter Header
                </h3>
                <p className="text-sm text-muted-foreground">
                  See how your brand colors look in an email campaign
                </p>
              </div>
              <Button style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
                Call to Action Button
              </Button>
              <div className="flex gap-2">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: colors.accent }}
                >
                  Accent Badge
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetToDefaults} disabled={isSaving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button onClick={saveBrandColors} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Colors'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Color Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Color Presets</CardTitle>
          <CardDescription>
            Quick start with pre-designed color combinations that work well together
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.primary }} />
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.secondary }} />
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.accent }} />
                  </div>
                </div>
                <p className="text-sm font-medium">{preset.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
