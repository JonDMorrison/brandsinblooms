import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui-legacy/dialog';
import { Button } from '@/components/ui-legacy/button';
import { Input } from '@/components/ui-legacy/input';
import { Label } from '@/components/ui-legacy/label';
import { RotateCcw } from 'lucide-react';
import { FooterStyling } from '@/types/footerStyling';
import { getCompanyInitials } from '@/types/newsletterFooter';
import { cn } from '@/lib/utils';

interface FooterStylingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styling: FooterStyling;
  onSave: (styling: FooterStyling) => void;
  companyName?: string;
  hasLogoImage: boolean;
  defaultColors: {
    backgroundColor: string;
    textColor: string;
    linkColor: string;
    dividerColor: string;
    logoBackground: string;
  };
}

// Color presets for quick selection
const COLOR_PRESETS = {
  backgrounds: [
    { label: 'Deep Green', value: '#283024' },
    { label: 'Navy', value: '#1e3a5f' },
    { label: 'Charcoal', value: '#374151' },
    { label: 'Cream', value: '#FAF9F6' },
    { label: 'White', value: '#FFFFFF' },
  ],
  accents: [
    { label: 'Warm Tan', value: '#E5BFA7' },
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Green', value: '#22C55E' },
    { label: 'Rose', value: '#F472B6' },
    { label: 'Gold', value: '#F59E0B' },
  ],
};

export const FooterStylingDialog: React.FC<FooterStylingDialogProps> = ({
  open,
  onOpenChange,
  styling,
  onSave,
  companyName,
  hasLogoImage,
  defaultColors,
}) => {
  const [localStyling, setLocalStyling] = useState<FooterStyling>(styling);

  useEffect(() => {
    if (open) {
      setLocalStyling(styling);
    }
  }, [open, styling]);

  const handleChange = (key: keyof FooterStyling, value: string) => {
    setLocalStyling(prev => ({ ...prev, [key]: value || undefined }));
  };

  const handleReset = () => {
    setLocalStyling({});
  };

  const handleSave = () => {
    onSave(localStyling);
    onOpenChange(false);
  };

  // Computed preview colors
  const previewBg = localStyling.backgroundColor || defaultColors.backgroundColor;
  const previewText = localStyling.textColor || defaultColors.textColor;
  const previewLink = localStyling.linkColor || defaultColors.linkColor;
  const previewDivider = localStyling.dividerColor || defaultColors.dividerColor;
  const previewLogoBg = localStyling.logoBackgroundColor || defaultColors.logoBackground;
  const previewLogoText = localStyling.logoTextColor || previewBg;
  const displayName = localStyling.companyNameOverride || companyName || 'Company Name';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Footer Style Settings</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Customize colors for this campaign's footer only
          </p>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Live Preview */}
          <div className="rounded-lg overflow-hidden border">
            <div 
              className="p-4 text-center"
              style={{ backgroundColor: previewBg }}
            >
              {!hasLogoImage && (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 font-bold text-sm"
                  style={{ backgroundColor: previewLogoBg, color: previewLogoText }}
                >
                  {getCompanyInitials(displayName)}
                </div>
              )}
              <div className="text-sm font-medium" style={{ color: previewText }}>
                {displayName}
              </div>
              <div 
                className="h-px w-24 mx-auto my-3"
                style={{ backgroundColor: previewDivider }}
              />
              <div className="text-xs space-x-2">
                <span style={{ color: previewLink }} className="underline cursor-pointer">
                  Unsubscribe
                </span>
                <span style={{ color: previewText, opacity: 0.6 }}>|</span>
                <span style={{ color: previewLink }} className="underline cursor-pointer">
                  Manage Preferences
                </span>
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localStyling.backgroundColor || defaultColors.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={localStyling.backgroundColor || ''}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                placeholder={defaultColors.backgroundColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_PRESETS.backgrounds.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handleChange('backgroundColor', preset.value)}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    localStyling.backgroundColor === preset.value 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localStyling.textColor || defaultColors.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={localStyling.textColor || ''}
                onChange={(e) => handleChange('textColor', e.target.value)}
                placeholder={defaultColors.textColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Link Accent Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Link Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localStyling.linkColor || defaultColors.linkColor}
                onChange={(e) => handleChange('linkColor', e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={localStyling.linkColor || ''}
                onChange={(e) => handleChange('linkColor', e.target.value)}
                placeholder={defaultColors.linkColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_PRESETS.accents.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handleChange('linkColor', preset.value)}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    localStyling.linkColor === preset.value 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          {/* Logo Colors - only show if no logo image */}
          {!hasLogoImage && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Logo Initials Colors</Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Background</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="color"
                      value={localStyling.logoBackgroundColor || defaultColors.logoBackground}
                      onChange={(e) => handleChange('logoBackgroundColor', e.target.value)}
                      className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Input
                      value={localStyling.logoBackgroundColor || ''}
                      onChange={(e) => handleChange('logoBackgroundColor', e.target.value)}
                      placeholder="Auto"
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Text</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="color"
                      value={localStyling.logoTextColor || previewBg}
                      onChange={(e) => handleChange('logoTextColor', e.target.value)}
                      className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Input
                      value={localStyling.logoTextColor || ''}
                      onChange={(e) => handleChange('logoTextColor', e.target.value)}
                      placeholder="Auto"
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Divider Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Divider Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={localStyling.dividerColor || defaultColors.dividerColor}
                onChange={(e) => handleChange('dividerColor', e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={localStyling.dividerColor || ''}
                onChange={(e) => handleChange('dividerColor', e.target.value)}
                placeholder={defaultColors.dividerColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
