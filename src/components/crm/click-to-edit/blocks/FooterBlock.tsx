import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Settings, RotateCcw, ExternalLink, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFooterSettings, buildFooterProps } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { getFooterStyleConfig, getCompanyInitials } from '@/types/newsletterFooter';
import { FooterStyling, hasFooterStylingOverrides } from '@/types/footerStyling';
import { FooterStylingDialog } from './FooterStylingDialog';

interface FooterBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
  campaignId?: string;
  footerBackgroundColor?: string;
  onFooterColorChange?: (color: string | undefined) => void;
}

// Inline SVG social icons
const SocialIcon: React.FC<{ platform: string; className?: string }> = ({ platform, className }) => {
  const icons: Record<string, React.ReactNode> = {
    facebook: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    tiktok: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    pinterest: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
      </svg>
    ),
    youtube: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    linkedin: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  };
  return <>{icons[platform]}</>;
};

export const FooterBlock: React.FC<FooterBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview,
  campaignId,
  footerBackgroundColor,
  onFooterColorChange
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStylingDialogOpen, setIsStylingDialogOpen] = useState(false);
  const { footerSettings, setFooterSettings, campaignOverrides, saveCampaignFooterOverride, clearCampaignFooterOverride, saveFooterStyling } = useFooterSettings(campaignId);
  const { companyInfo } = useCompanyInfo();

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...footerSettings, [key]: value };
    setFooterSettings(newSettings);
  };

  const handleColorChange = async (color: string) => {
    if (campaignId) {
      await saveCampaignFooterOverride(campaignId, { footerBackgroundColor: color });
    }
    onFooterColorChange?.(color);
  };

  const handleResetColor = async () => {
    if (campaignId) {
      await clearCampaignFooterOverride(campaignId);
    }
    onFooterColorChange?.(undefined);
  };

  // Local state for footer styling when campaign doesn't exist yet
  const [localFooterStyling, setLocalFooterStyling] = useState<FooterStyling>({});

  const handleSaveStyling = async (styling: FooterStyling) => {
    // Always update local state immediately for preview
    setLocalFooterStyling(styling);
    
    // If we have a campaignId, save to database
    if (campaignId && saveFooterStyling) {
      await saveFooterStyling(campaignId, styling);
    }
    
    // Update the background color for immediate preview
    if (styling.backgroundColor) {
      onFooterColorChange?.(styling.backgroundColor);
    }
  };

  // Get footer styling from: 1) campaign metadata, 2) local state
  const footerStyling: FooterStyling = campaignOverrides.footerStyling || localFooterStyling;

  // Get computed styles - now considering per-campaign styling
  const effectiveBackgroundColor = footerStyling.backgroundColor || footerBackgroundColor || campaignOverrides.footerBackgroundColor || companyInfo.brandPrimaryColor;
  const baseStyles = getFooterStyleConfig(effectiveBackgroundColor, companyInfo.brandPrimaryColor);
  
  // Apply per-campaign styling overrides
  const styles = {
    backgroundColor: footerStyling.backgroundColor || baseStyles.backgroundColor,
    textPrimary: footerStyling.textColor || baseStyles.textPrimary,
    textMuted: footerStyling.textColor ? `${footerStyling.textColor}B3` : baseStyles.textMuted, // 70% opacity
    linkAccent: footerStyling.linkColor || baseStyles.linkAccent,
    dividerColor: footerStyling.dividerColor || baseStyles.dividerColor,
  };

  // Build social links array - prioritize companyInfo (fresh data from Contact & Footer Settings)
  const socialLinks = [
    { platform: 'facebook', url: companyInfo.facebookUrl || footerSettings.facebookUrl },
    { platform: 'instagram', url: companyInfo.instagramUrl || footerSettings.instagramUrl },
    { platform: 'tiktok', url: companyInfo.tiktokUrl || footerSettings.tiktokUrl },
    { platform: 'pinterest', url: companyInfo.pinterestUrl || footerSettings.pinterestUrl },
    { platform: 'youtube', url: companyInfo.youtubeUrl || footerSettings.youtubeUrl },
    { platform: 'linkedin', url: companyInfo.linkedinUrl || footerSettings.linkedinUrl },
  ].filter(s => s.url);

  // Build address string - prioritize companyInfo (fresh data from Contact & Footer Settings)
  const addressParts: string[] = [];
  const streetAddr = companyInfo.streetAddress || footerSettings.addressLine1 || companyInfo.address;
  if (streetAddr) addressParts.push(streetAddr);
  if (footerSettings.addressLine2) addressParts.push(footerSettings.addressLine2);
  const cityLine = [
    companyInfo.city || footerSettings.city, 
    companyInfo.stateProvince || footerSettings.region, 
    companyInfo.postalCode || footerSettings.postalCode
  ].filter(Boolean).join(', ');
  if (cityLine) addressParts.push(cityLine);
  const countryVal = companyInfo.country || footerSettings.country;
  if (countryVal) addressParts.push(countryVal);

  const hasAddress = addressParts.length > 0;
  // Use fresh companyInfo for email and phone
  const emailAddr = companyInfo.email || footerSettings.email;
  const hasContact = emailAddr || (footerSettings.showPhone && companyInfo.phone);
  const hasSocial = socialLinks.length > 0;

  // Company name (with possible override)
  const displayCompanyName = footerStyling.companyNameOverride || companyInfo.name;

  // Logo colors from styling
  const logoBackgroundColor = footerStyling.logoBackgroundColor || styles.linkAccent;
  const logoTextColor = footerStyling.logoTextColor || styles.backgroundColor;

  // Logo or initials
  const hasLogoImage = !!(footerSettings.showLogo && companyInfo.logoUrl);
  const logoElement = hasLogoImage ? (
    <img 
      src={companyInfo.logoUrl} 
      alt={`${displayCompanyName} logo`}
      className="h-10 object-contain mb-3"
    />
  ) : (
    <div 
      className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 font-bold text-lg"
      style={{ backgroundColor: logoBackgroundColor, color: logoTextColor }}
    >
      {getCompanyInitials(displayCompanyName)}
    </div>
  );

  // Default colors for the styling dialog
  const defaultColorsForDialog = {
    backgroundColor: baseStyles.backgroundColor,
    textColor: baseStyles.textPrimary,
    linkColor: baseStyles.linkAccent,
    dividerColor: baseStyles.dividerColor,
    logoBackground: baseStyles.linkAccent,
  };

  // Toolbar component shared between preview and editor
  const renderToolbar = () => (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 bg-white border rounded-lg shadow-lg px-2 py-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsStylingDialogOpen(true)}
        className="h-7 px-2.5 text-xs gap-1.5"
      >
        <Palette className="h-3.5 w-3.5" />
        Customize Colors
      </Button>
      <div className="w-px h-4 bg-border" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="h-7 px-2.5 text-xs gap-1.5"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </Button>
      {hasFooterStylingOverrides(footerStyling) && (
        <>
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (campaignId && saveFooterStyling) {
                await saveFooterStyling(campaignId, {});
                onFooterColorChange?.(undefined);
              }
            }}
            className="h-7 px-2 text-xs text-muted-foreground"
            title="Reset to default colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  if (isPreview) {
    return (
      <div 
        className="relative group w-full mt-10"
        style={{ backgroundColor: styles.backgroundColor }}
      >
        {renderToolbar()}
        <div className="max-w-[640px] mx-auto px-4 py-8">
          {/* Three-column layout */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Logo & Brand */}
            <div className="flex-1 text-center md:text-left">
              {logoElement}
              {displayCompanyName && (
                <div className="text-sm font-medium mb-1" style={{ color: styles.textPrimary }}>
                  {displayCompanyName}
                </div>
              )}
              {footerSettings.websiteUrl && (
                <a 
                  href={footerSettings.websiteUrl} 
                  className="text-xs hover:underline"
                  style={{ color: styles.textMuted }}
                >
                  {footerSettings.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {/* Middle: Address & Contact */}
            <div className="flex-1 text-center md:text-left">
              {hasAddress && (
                <div className="text-[13px] leading-relaxed mb-2" style={{ color: styles.textMuted }}>
                  {addressParts.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
              {hasContact && (
                <div className="text-xs space-x-2" style={{ color: styles.textMuted }}>
                  {emailAddr && (
                    <a href={`mailto:${emailAddr}`} className="hover:underline">
                      {emailAddr}
                    </a>
                  )}
                  {emailAddr && companyInfo.phone && footerSettings.showPhone && (
                    <span>|</span>
                  )}
                  {footerSettings.showPhone && companyInfo.phone && (
                    <span>{companyInfo.phone}</span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Social Icons */}
            {hasSocial && (
              <div className="flex-1 flex justify-center md:justify-end">
                <div className="flex gap-3">
                  {socialLinks.map(({ platform, url }) => (
                    <a 
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-opacity hover:opacity-80"
                      style={{ color: styles.textPrimary }}
                    >
                      <SocialIcon platform={platform} className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div 
            className="h-px my-6"
            style={{ backgroundColor: styles.dividerColor }}
          />

          {/* Compliance Strip */}
          <div className="text-center">
            {(companyInfo.footerLegalText || footerSettings.complianceText) && (
              <p 
                className="text-xs max-w-md mx-auto mb-3 leading-relaxed"
                style={{ color: styles.textMuted }}
              >
                {(companyInfo.footerLegalText || footerSettings.complianceText).replace(/\{\{company\.name\}\}/g, displayCompanyName || 'Our Company')}
              </p>
            )}
            
            <div className="text-xs space-x-2">
              <a 
                href="#unsubscribe" 
                className="underline"
                style={{ color: styles.linkAccent }}
              >
                Unsubscribe
              </a>
              {footerSettings.showManagePreferences && (
                <>
                  <span style={{ color: styles.textMuted }}>|</span>
                  <a 
                    href="#preferences" 
                    className="underline"
                    style={{ color: styles.linkAccent }}
                  >
                    Manage Preferences
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Styling Dialog - also available in preview */}
        <FooterStylingDialog
          open={isStylingDialogOpen}
          onOpenChange={setIsStylingDialogOpen}
          styling={footerStyling}
          onSave={handleSaveStyling}
          companyName={companyInfo.name}
          hasLogoImage={hasLogoImage}
          defaultColors={defaultColorsForDialog}
        />

        {/* Settings Panel - also available in preview */}
        {isSettingsOpen && (
          <Card className="absolute top-16 right-4 z-50 w-96 max-h-[70vh] overflow-y-auto p-4 shadow-lg border-2 border-primary/20 bg-white">
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
              <Link 
                to="/profile/contact-footer" 
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 px-2 -mx-2 rounded hover:bg-muted/50"
              >
                <ExternalLink className="w-3 h-3" />
                Edit company contact info & social links
              </Link>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Editor view
  return (
    <div className="relative group py-8">
      {/* Hover Toolbar */}
      {renderToolbar()}

      {/* Footer Styling Dialog */}
      <FooterStylingDialog
        open={isStylingDialogOpen}
        onOpenChange={setIsStylingDialogOpen}
        styling={footerStyling}
        onSave={handleSaveStyling}
        companyName={companyInfo.name}
        hasLogoImage={hasLogoImage}
        defaultColors={defaultColorsForDialog}
      />

      {/* Settings Panel */}
      {isSettingsOpen && (
        <Card className="absolute top-12 right-0 z-50 w-96 max-h-[70vh] overflow-y-auto p-4 shadow-lg border-2 border-primary/20 bg-white">
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

            {/* Link to Contact & Footer Settings */}
            <Link 
              to="/profile/contact-footer" 
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 px-2 -mx-2 rounded hover:bg-muted/50"
            >
              <ExternalLink className="w-3 h-3" />
              Edit company contact info & social links
            </Link>

            {/* Campaign Footer Color */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Footer Background (This Campaign)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={effectiveBackgroundColor || '#283024'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-14 h-9 p-1"
                />
                <Input
                  value={effectiveBackgroundColor || '#283024'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#283024"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetColor}
                  title="Reset to brand default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Override the footer color for this campaign only</p>
            </div>

            {/* Toggle Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Logo</Label>
                <Switch
                  checked={footerSettings.showLogo}
                  onCheckedChange={(checked) => handleSettingChange('showLogo', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Phone Number</Label>
                <Switch
                  checked={footerSettings.showPhone}
                  onCheckedChange={(checked) => handleSettingChange('showPhone', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Show Manage Preferences</Label>
                <Switch
                  checked={footerSettings.showManagePreferences}
                  onCheckedChange={(checked) => handleSettingChange('showManagePreferences', checked)}
                />
              </div>
            </div>

            {/* Address Fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Address</Label>
              <Input
                value={footerSettings.addressLine1 || ''}
                onChange={(e) => handleSettingChange('addressLine1', e.target.value)}
                placeholder="Street address"
                className="text-sm"
              />
              <Input
                value={footerSettings.addressLine2 || ''}
                onChange={(e) => handleSettingChange('addressLine2', e.target.value)}
                placeholder="Suite, unit, etc."
                className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={footerSettings.city || ''}
                  onChange={(e) => handleSettingChange('city', e.target.value)}
                  placeholder="City"
                  className="text-sm"
                />
                <Input
                  value={footerSettings.region || ''}
                  onChange={(e) => handleSettingChange('region', e.target.value)}
                  placeholder="State"
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={footerSettings.postalCode || ''}
                  onChange={(e) => handleSettingChange('postalCode', e.target.value)}
                  placeholder="ZIP"
                  className="text-sm"
                />
                <Input
                  value={footerSettings.country || ''}
                  onChange={(e) => handleSettingChange('country', e.target.value)}
                  placeholder="Country"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Contact Fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Contact</Label>
              <Input
                value={footerSettings.email || ''}
                onChange={(e) => handleSettingChange('email', e.target.value)}
                placeholder="Email address"
                className="text-sm"
              />
              <Input
                value={footerSettings.websiteUrl || ''}
                onChange={(e) => handleSettingChange('websiteUrl', e.target.value)}
                placeholder="Website URL"
                className="text-sm"
              />
            </div>

            {/* Social Links */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Social Links</Label>
              <Input
                value={footerSettings.facebookUrl || ''}
                onChange={(e) => handleSettingChange('facebookUrl', e.target.value)}
                placeholder="Facebook URL"
                className="text-sm"
              />
              <Input
                value={footerSettings.instagramUrl || ''}
                onChange={(e) => handleSettingChange('instagramUrl', e.target.value)}
                placeholder="Instagram URL"
                className="text-sm"
              />
              <Input
                value={footerSettings.tiktokUrl || ''}
                onChange={(e) => handleSettingChange('tiktokUrl', e.target.value)}
                placeholder="TikTok URL"
                className="text-sm"
              />
              <Input
                value={footerSettings.youtubeUrl || ''}
                onChange={(e) => handleSettingChange('youtubeUrl', e.target.value)}
                placeholder="YouTube URL"
                className="text-sm"
              />
              <Input
                value={footerSettings.linkedinUrl || ''}
                onChange={(e) => handleSettingChange('linkedinUrl', e.target.value)}
                placeholder="LinkedIn URL"
                className="text-sm"
              />
              <Input
                value={footerSettings.pinterestUrl || ''}
                onChange={(e) => handleSettingChange('pinterestUrl', e.target.value)}
                placeholder="Pinterest URL"
                className="text-sm"
              />
            </div>

            {/* Compliance Text */}
            <div>
              <Label className="text-sm font-medium">Legal / Compliance Text</Label>
              <Textarea
                value={footerSettings.complianceText}
                onChange={(e) => handleSettingChange('complianceText', e.target.value)}
                placeholder="Enter compliance text..."
                className="w-full text-xs mt-1"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{company.name}}"} for dynamic company name
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Simplified Editor Preview */}
      <div 
        className="w-full min-h-[120px] p-4 rounded border border-dashed border-gray-300"
        style={{ backgroundColor: styles.backgroundColor }}
      >
        <div className="text-center text-xs mb-3" style={{ color: styles.textMuted }}>
          📧 Email Footer (Auto-included in all emails)
        </div>
        
        <div className="max-w-md mx-auto text-center">
          {logoElement}
          
          <div className="text-sm font-medium" style={{ color: styles.textPrimary }}>
            {displayCompanyName}
          </div>
          
          {hasAddress && (
            <div className="text-xs mt-2" style={{ color: styles.textMuted }}>
              {addressParts[0]}
            </div>
          )}
          
          {hasSocial && (
            <div className="flex justify-center gap-2 mt-3">
              {socialLinks.slice(0, 4).map(({ platform }) => (
                <div key={platform} style={{ color: styles.textPrimary }}>
                  <SocialIcon platform={platform} className="w-4 h-4" />
                </div>
              ))}
              {socialLinks.length > 4 && (
                <span className="text-xs" style={{ color: styles.textMuted }}>+{socialLinks.length - 4}</span>
              )}
            </div>
          )}
          
          <div 
            className="h-px my-3 mx-auto w-32"
            style={{ backgroundColor: styles.dividerColor }}
          />
          
          <div className="flex items-center justify-center gap-2 text-xs">
            <span style={{ color: styles.linkAccent }} className="underline">Unsubscribe</span>
            {footerSettings.showManagePreferences && (
              <>
                <span style={{ color: styles.textMuted }}>|</span>
                <span style={{ color: styles.linkAccent }} className="underline">Manage Preferences</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
