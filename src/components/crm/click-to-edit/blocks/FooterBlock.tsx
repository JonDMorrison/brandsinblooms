import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Settings, Building, Mail, Phone, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

interface FooterBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const FooterBlock: React.FC<FooterBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview 
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { footerSettings, setFooterSettings } = useFooterSettings();
  const { companyInfo } = useCompanyInfo();

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...footerSettings, [key]: value };
    setFooterSettings(newSettings);
  };

  // Parse tokens in text
  const parseTokens = (text: string) => {
    return text
      .replace(/\{\{company\.name\}\}/g, companyInfo.name || 'Your Company')
      .replace(/\{\{unsubscribe_url\}\}/g, isPreview ? '#unsubscribe' : '{{unsubscribe_url}}')
      .replace(/\{\{manage_preferences_url\}\}/g, isPreview ? '#preferences' : '{{manage_preferences_url}}');
  };

  const backgroundColors = {
    light: 'bg-gray-50',
    dark: 'bg-gray-800 text-white',
    white: 'bg-white'
  };

  const paddingClasses = {
    compact: 'py-4 px-3',
    normal: 'py-6 px-4',
    spacious: 'py-8 px-6'
  };

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center'
  };

  const fontSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm'
  };

  if (isPreview) {
    return (
      <div className={cn(
        backgroundColors[footerSettings.backgroundColor],
        footerSettings.showDivider && 'border-t border-gray-200',
        'w-full'
      )}>
        <div className={cn(
          paddingClasses[footerSettings.padding],
          alignmentClasses[footerSettings.alignment],
          fontSizeClasses[footerSettings.fontSize],
          'max-w-2xl mx-auto space-y-3',
          footerSettings.backgroundColor === 'dark' ? 'text-gray-300' : 'text-gray-600'
        )}>
          {/* Logo */}
          {footerSettings.showLogo && companyInfo.logoUrl && (
            <div className="mb-4">
              <img 
                src={companyInfo.logoUrl} 
                alt={`${companyInfo.name} logo`}
                className="h-8 mx-auto object-contain"
              />
            </div>
          )}

          {/* Company Info */}
          <div className="space-y-1">
            <div className="font-medium">{companyInfo.name}</div>
            {companyInfo.address && (
              <div>{companyInfo.address}</div>
            )}
            {footerSettings.showPhone && companyInfo.phone && (
              <div className="flex items-center justify-center gap-1">
                <Phone className="h-3 w-3" />
                {companyInfo.phone}
              </div>
            )}
          </div>

          {/* Custom Footer Text */}
          {footerSettings.customFooterText && (
            <div className="border-t border-gray-300 pt-3 mt-3">
              {parseTokens(footerSettings.customFooterText)}
            </div>
          )}

          {/* Compliance Notice */}
          <div className="border-t border-gray-300 pt-3 mt-3">
            {parseTokens(footerSettings.complianceText)}
          </div>

          {/* Action Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a 
              href={isPreview ? '#unsubscribe' : '{{unsubscribe_url}}'} 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Unsubscribe
            </a>
            {footerSettings.showManagePreferences && (
              <>
                <span className="hidden sm:inline text-gray-400">|</span>
                <a 
                  href={isPreview ? '#preferences' : '{{manage_preferences_url}}'} 
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Manage Preferences
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Editor view
  return (
    <div className="relative group">
      {/* Settings Button */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="h-8 w-8 p-0 bg-white shadow-sm"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <Card className="absolute top-12 right-0 z-20 w-80 p-4 shadow-lg border-2 border-primary/20">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Footer Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Phone Number</Label>
                <Switch
                  checked={footerSettings.showPhone}
                  onCheckedChange={(checked) => handleSettingChange('showPhone', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Logo</Label>
                <Switch
                  checked={footerSettings.showLogo}
                  onCheckedChange={(checked) => handleSettingChange('showLogo', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Manage Preferences</Label>
                <Switch
                  checked={footerSettings.showManagePreferences}
                  onCheckedChange={(checked) => handleSettingChange('showManagePreferences', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Divider</Label>
                <Switch
                  checked={footerSettings.showDivider}
                  onCheckedChange={(checked) => handleSettingChange('showDivider', checked)}
                />
              </div>
            </div>

            {/* Style Options */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Alignment</Label>
                <NativeSelect
                  value={footerSettings.alignment}
                  onChange={(e) => handleSettingChange('alignment', e.target.value)}
                  options={[
                    { value: 'center', label: 'Center' },
                    { value: 'left', label: 'Left' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-sm">Padding</Label>
                <NativeSelect
                  value={footerSettings.padding}
                  onChange={(e) => handleSettingChange('padding', e.target.value)}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'spacious', label: 'Spacious' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-sm">Background</Label>
                <NativeSelect
                  value={footerSettings.backgroundColor}
                  onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
                  options={[
                    { value: 'light', label: 'Light Gray' },
                    { value: 'white', label: 'White' },
                    { value: 'dark', label: 'Dark' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-sm">Font Size</Label>
                <NativeSelect
                  value={footerSettings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                  options={[
                    { value: 'xs', label: 'Extra Small' },
                    { value: 'sm', label: 'Small' }
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            {/* Compliance Text */}
            <div>
              <Label className="text-sm">Compliance Notice</Label>
              <Textarea
                value={footerSettings.complianceText}
                onChange={(e) => handleSettingChange('complianceText', e.target.value)}
                placeholder="Enter compliance text..."
                className="w-full text-xs"
                rows={3}
              />
            </div>

            {/* Custom Footer Text */}
            <div>
              <Label className="text-sm">Additional Footer Text (Optional)</Label>
              <Textarea
                value={footerSettings.customFooterText || ''}
                onChange={(e) => handleSettingChange('customFooterText', e.target.value)}
                placeholder="Enter additional footer text..."
                className="w-full text-xs"
                rows={2}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Preview within editor */}
      <div className={cn(
        backgroundColors[footerSettings.backgroundColor],
        footerSettings.showDivider && 'border-t border-gray-200',
        'w-full min-h-[100px] p-4 rounded border border-dashed border-gray-300'
      )}>
        <div className={cn(
          paddingClasses[footerSettings.padding],
          alignmentClasses[footerSettings.alignment],
          fontSizeClasses[footerSettings.fontSize],
          'max-w-2xl mx-auto space-y-3',
          footerSettings.backgroundColor === 'dark' ? 'text-gray-300' : 'text-gray-600'
        )}>
          <div className="text-center text-sm text-muted-foreground mb-2">
            📧 Email Footer (Auto-included)
          </div>
          
          {/* Simplified preview */}
          <div className="space-y-1">
            <div className="font-medium">{companyInfo.name}</div>
            <div className="text-xs">{companyInfo.address}</div>
          </div>
          
          <div className="text-xs border-t pt-2">
            {parseTokens(footerSettings.complianceText).substring(0, 60)}...
          </div>
          
          <div className="flex items-center justify-center gap-3 text-xs">
            <a href="#" className="text-blue-600 underline">Unsubscribe</a>
            {footerSettings.showManagePreferences && (
              <a href="#" className="text-blue-600 underline">Manage Preferences</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};