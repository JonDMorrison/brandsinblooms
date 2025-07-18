import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GlobalSettings } from '@/types/emailBuilder';

interface GlobalSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

export const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({
  open,
  onClose,
  settings,
  onUpdate
}) => {
  const updateSettings = (section: keyof GlobalSettings, key: string, value: string) => {
    if (typeof settings[section] === 'object') {
      onUpdate({
        ...settings,
        [section]: {
          ...settings[section],
          [key]: value
        }
      });
    } else {
      onUpdate({
        ...settings,
        [section]: value
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-96 sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Global Email Styling</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fontFamily">Font Family</Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) => updateSettings('fontFamily', '', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                    <SelectItem value="Georgia, serif">Georgia</SelectItem>
                    <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                    <SelectItem value="'Helvetica Neue', sans-serif">Helvetica</SelectItem>
                    <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                    <SelectItem value="'Open Sans', sans-serif">Open Sans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="fontSize">Base Font Size</Label>
                <Select
                  value={settings.fontSize}
                  onValueChange={(value) => updateSettings('fontSize', '', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14px">14px</SelectItem>
                    <SelectItem value="16px">16px</SelectItem>
                    <SelectItem value="18px">18px</SelectItem>
                    <SelectItem value="20px">20px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Button Styling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Button Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="buttonBg">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="buttonBg"
                    type="color"
                    value={settings.buttonStyle.backgroundColor}
                    onChange={(e) => updateSettings('buttonStyle', 'backgroundColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.buttonStyle.backgroundColor}
                    onChange={(e) => updateSettings('buttonStyle', 'backgroundColor', e.target.value)}
                    placeholder="#22C55E"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="buttonText">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="buttonText"
                    type="color"
                    value={settings.buttonStyle.textColor}
                    onChange={(e) => updateSettings('buttonStyle', 'textColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.buttonStyle.textColor}
                    onChange={(e) => updateSettings('buttonStyle', 'textColor', e.target.value)}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="buttonRadius">Corner Radius</Label>
                <Select
                  value={settings.buttonStyle.cornerRadius}
                  onValueChange={(value) => updateSettings('buttonStyle', 'cornerRadius', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select radius" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0px">Sharp (0px)</SelectItem>
                    <SelectItem value="4px">Small (4px)</SelectItem>
                    <SelectItem value="6px">Medium (6px)</SelectItem>
                    <SelectItem value="8px">Large (8px)</SelectItem>
                    <SelectItem value="12px">Extra Large (12px)</SelectItem>
                    <SelectItem value="999px">Rounded (999px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Header Styling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Header Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="headerBg">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="headerBg"
                    type="color"
                    value={settings.headerStyle.backgroundColor}
                    onChange={(e) => updateSettings('headerStyle', 'backgroundColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.headerStyle.backgroundColor}
                    onChange={(e) => updateSettings('headerStyle', 'backgroundColor', e.target.value)}
                    placeholder="#F8F9FA"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="headerText">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="headerText"
                    type="color"
                    value={settings.headerStyle.textColor}
                    onChange={(e) => updateSettings('headerStyle', 'textColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.headerStyle.textColor}
                    onChange={(e) => updateSettings('headerStyle', 'textColor', e.target.value)}
                    placeholder="#1F2937"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer Styling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Footer Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="footerBg">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="footerBg"
                    type="color"
                    value={settings.footerStyle.backgroundColor}
                    onChange={(e) => updateSettings('footerStyle', 'backgroundColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.footerStyle.backgroundColor}
                    onChange={(e) => updateSettings('footerStyle', 'backgroundColor', e.target.value)}
                    placeholder="#F8F9FA"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="footerText">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="footerText"
                    type="color"
                    value={settings.footerStyle.textColor}
                    onChange={(e) => updateSettings('footerStyle', 'textColor', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    value={settings.footerStyle.textColor}
                    onChange={(e) => updateSettings('footerStyle', 'textColor', e.target.value)}
                    placeholder="#6B7280"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Style Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                {/* Header Preview */}
                <div
                  style={{
                    backgroundColor: settings.headerStyle.backgroundColor,
                    color: settings.headerStyle.textColor,
                    fontFamily: settings.fontFamily,
                    padding: '16px',
                    textAlign: 'center'
                  }}
                >
                  <h2 style={{ margin: 0, fontWeight: 'bold' }}>Header Title</h2>
                </div>
                
                {/* Content Preview */}
                <div
                  style={{
                    fontFamily: settings.fontFamily,
                    fontSize: settings.fontSize,
                    padding: '16px'
                  }}
                >
                  <p style={{ margin: '0 0 16px 0' }}>This is how your email content will look.</p>
                  
                  {/* Button Preview */}
                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: settings.buttonStyle.backgroundColor,
                        color: settings.buttonStyle.textColor,
                        borderRadius: settings.buttonStyle.cornerRadius,
                        textDecoration: 'none',
                        fontWeight: 'bold'
                      }}
                    >
                      Sample Button
                    </span>
                  </div>
                </div>
                
                {/* Footer Preview */}
                <div
                  style={{
                    backgroundColor: settings.footerStyle.backgroundColor,
                    color: settings.footerStyle.textColor,
                    fontFamily: settings.fontFamily,
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}
                >
                  Footer content
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};