import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTypographySettings } from '@/hooks/useTypographySettings';
import { NativeSelect } from '@/components/ui/native-select';
import { Loader2 } from 'lucide-react';

export const TypographyTab = () => {
  const { 
    availableFonts, 
    headlineFont, 
    subheadingFont, 
    bodyFont, 
    buttonFont,
    isLoading, 
    isSaving, 
    saveTypographySettings 
  } = useTypographySettings();

  const [previewHeadline, setPreviewHeadline] = useState<string | null>(null);
  const [previewSubheading, setPreviewSubheading] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [previewButton, setPreviewButton] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  // Load fonts dynamically
  const loadFont = (fontUrl: string) => {
    if (!loadedFonts.has(fontUrl)) {
      const link = document.createElement('link');
      link.href = fontUrl;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      setLoadedFonts(prev => new Set([...prev, fontUrl]));
    }
  };

  // Load all available fonts for preview
  useEffect(() => {
    availableFonts.forEach(font => loadFont(font.googleFontsUrl));
  }, [availableFonts]);

  const handleSave = async () => {
    await saveTypographySettings({
      headlineFontId: previewHeadline || headlineFont?.id,
      subheadingFontId: previewSubheading || subheadingFont?.id,
      bodyFontId: previewBody || bodyFont?.id,
      buttonFontId: previewButton || buttonFont?.id,
    });
    
    // Reset preview state after successful save
    setPreviewHeadline(null);
    setPreviewSubheading(null);
    setPreviewBody(null);
    setPreviewButton(null);
  };

  const handleReset = () => {
    setPreviewHeadline(null);
    setPreviewSubheading(null);
    setPreviewBody(null);
    setPreviewButton(null);
  };

  const getEffectiveFont = (previewId: string | null, currentFont: any) => {
    if (previewId) {
      return availableFonts.find(f => f.id === previewId);
    }
    return currentFont || availableFonts.find(f => f.name === 'quicksand');
  };

  const currentHeadline = getEffectiveFont(previewHeadline, headlineFont);
  const currentSubheading = getEffectiveFont(previewSubheading, subheadingFont);
  const currentBody = getEffectiveFont(previewBody, bodyFont);
  const currentButton = getEffectiveFont(previewButton, buttonFont);

  const hasChanges = previewHeadline || previewSubheading || previewBody || previewButton;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Typography Settings</CardTitle>
          <CardDescription>
            Configure fonts for different text elements in your newsletters. Choose fonts that create visual hierarchy and reflect your brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Headlines Font Selector */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Headlines (H1)</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Used for main titles and primary headings
              </p>
            </div>
            <NativeSelect
              value={previewHeadline || headlineFont?.id || ''}
              onChange={(e) => setPreviewHeadline(e.target.value)}
            >
              <option value="">Select headline font</option>
              {availableFonts.map(font => (
                <option key={font.id} value={font.id}>
                  {font.displayName}
                </option>
              ))}
            </NativeSelect>
            {currentHeadline && (
              <div className="text-sm text-muted-foreground">
                Current: <span style={{ fontFamily: currentHeadline.fontFamilyCss, fontWeight: 600 }}>
                  {currentHeadline.displayName}
                </span>
              </div>
            )}
          </div>

          {/* Subheadings Font Selector */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Subheadings (H2, H3)</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Used for section titles and secondary headings
              </p>
            </div>
            <NativeSelect
              value={previewSubheading || subheadingFont?.id || ''}
              onChange={(e) => setPreviewSubheading(e.target.value)}
            >
              <option value="">Select subheading font</option>
              {availableFonts.map(font => (
                <option key={font.id} value={font.id}>
                  {font.displayName}
                </option>
              ))}
            </NativeSelect>
            {currentSubheading && (
              <div className="text-sm text-muted-foreground">
                Current: <span style={{ fontFamily: currentSubheading.fontFamilyCss, fontWeight: 600 }}>
                  {currentSubheading.displayName}
                </span>
              </div>
            )}
          </div>

          {/* Body Text Font Selector */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Body Text</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Used for paragraphs and main content
              </p>
            </div>
            <NativeSelect
              value={previewBody || bodyFont?.id || ''}
              onChange={(e) => setPreviewBody(e.target.value)}
            >
              <option value="">Select body font</option>
              {availableFonts.map(font => (
                <option key={font.id} value={font.id}>
                  {font.displayName}
                </option>
              ))}
            </NativeSelect>
            {currentBody && (
              <div className="text-sm text-muted-foreground">
                Current: <span style={{ fontFamily: currentBody.fontFamilyCss, fontWeight: 600 }}>
                  {currentBody.displayName}
                </span>
              </div>
            )}
          </div>

          {/* Buttons Font Selector */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Buttons & CTAs</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Used for call-to-action buttons and links
              </p>
            </div>
            <NativeSelect
              value={previewButton || buttonFont?.id || ''}
              onChange={(e) => setPreviewButton(e.target.value)}
            >
              <option value="">Select button font</option>
              {availableFonts.map(font => (
                <option key={font.id} value={font.id}>
                  {font.displayName}
                </option>
              ))}
            </NativeSelect>
            {currentButton && (
              <div className="text-sm text-muted-foreground">
                Current: <span style={{ fontFamily: currentButton.fontFamilyCss, fontWeight: 700 }}>
                  {currentButton.displayName}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            See how your selected fonts work together in a newsletter context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 bg-muted/30 p-8 rounded-lg">
          {currentHeadline && (
            <h1 
              style={{ 
                fontFamily: currentHeadline.fontFamilyCss,
                fontSize: '32px',
                fontWeight: 'bold',
                lineHeight: '1.2',
                color: 'hsl(var(--foreground))'
              }}
            >
              Main Headline Goes Here
            </h1>
          )}
          
          {currentSubheading && (
            <h2 
              style={{ 
                fontFamily: currentSubheading.fontFamilyCss,
                fontSize: '24px',
                fontWeight: '600',
                lineHeight: '1.3',
                color: 'hsl(var(--foreground))',
                marginTop: '16px'
              }}
            >
              Section Heading
            </h2>
          )}
          
          {currentBody && (
            <p 
              style={{ 
                fontFamily: currentBody.fontFamilyCss,
                fontSize: '16px',
                lineHeight: '1.6',
                color: 'hsl(var(--foreground))',
                marginTop: '12px'
              }}
            >
              This is body text that will appear in your newsletters. It shows how readable your content will be with the selected font. Good body text fonts should be clear and easy to read at various sizes. They form the foundation of your newsletter's typography and will be used for most of your content.
            </p>
          )}
          
          {currentButton && (
            <div style={{ marginTop: '24px' }}>
              <Button
                style={{
                  fontFamily: currentButton.fontFamilyCss,
                }}
                className="font-bold"
              >
                Learn More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Typography Tips */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">💡 Typography Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Use sans-serif fonts for headlines (modern, clean look)</p>
          <p>• Choose highly readable fonts for body text</p>
          <p>• Keep button fonts bold and clear for strong CTAs</p>
          <p>• Limit to 2-3 font families maximum for cohesive design</p>
          <p>• Test readability at different sizes before finalizing</p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || isSaving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
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
    </div>
  );
};
