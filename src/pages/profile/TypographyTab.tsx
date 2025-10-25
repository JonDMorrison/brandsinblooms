import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTypographySettings } from '@/hooks/useTypographySettings';
import { Loader2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TypographyTab: React.FC = () => {
  const { availableFonts, selectedFont, isLoading, isSaving, saveFont } = useTypographySettings();
  const [previewFont, setPreviewFont] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  // Load font dynamically for preview
  const loadFont = (url: string, fontName: string) => {
    if (loadedFonts.has(fontName)) return;

    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    setLoadedFonts(prev => new Set(prev).add(fontName));
  };

  // Load all fonts for preview
  useEffect(() => {
    availableFonts.forEach(font => {
      loadFont(font.googleFontsUrl, font.name);
    });
  }, [availableFonts]);

  const handleSelectFont = (fontId: string) => {
    setPreviewFont(fontId);
  };

  const handleSave = () => {
    if (previewFont) {
      saveFont(previewFont);
    }
  };

  const handleReset = () => {
    setPreviewFont(selectedFont?.id || null);
  };

  const currentPreview = previewFont 
    ? availableFonts.find(f => f.id === previewFont) 
    : selectedFont;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            <CardTitle>Typography Settings</CardTitle>
          </div>
          <CardDescription>
            Choose the font for your email newsletters. This will be applied to all email content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Font Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Available Fonts</h3>
            <div className="space-y-2">
              {availableFonts.map(font => {
                const isSelected = (previewFont || selectedFont?.id) === font.id;
                
                return (
                  <button
                    key={font.id}
                    onClick={() => handleSelectFont(font.id)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        isSelected ? "border-primary" : "border-muted-foreground"
                      )}>
                        {isSelected && (
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{font.displayName}</div>
                        <div 
                          className="text-lg mt-1 text-muted-foreground"
                          style={{ fontFamily: font.fontFamilyCss }}
                        >
                          The quick brown fox jumps over the lazy dog
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          {currentPreview && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Preview</h3>
              <Card className="border-2">
                <CardContent className="p-6 space-y-4">
                  <div 
                    className="text-3xl font-bold text-foreground"
                    style={{ fontFamily: currentPreview.fontFamilyCss }}
                  >
                    Newsletter Headline
                  </div>
                  <div 
                    className="text-base text-muted-foreground leading-relaxed"
                    style={{ fontFamily: currentPreview.fontFamilyCss }}
                  >
                    This is how your email content will appear to your subscribers. 
                    The selected font will be applied consistently across all text in your newsletters, 
                    including headlines, body text, and buttons.
                  </div>
                  <div 
                    className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md font-semibold"
                    style={{ fontFamily: currentPreview.fontFamilyCss }}
                  >
                    Call to Action Button
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!previewFont || previewFont === selectedFont?.id}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !previewFont || previewFont === selectedFont?.id}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Typography'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
