import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Palette, RotateCcw } from 'lucide-react';
import { hasFooterStylingOverrides } from '@/types/footerStyling';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { getFooterStyleConfig, getCompanyInitials, DEFAULT_FOOTER_COLORS } from '@/types/newsletterFooter';
import { FooterStyling } from '@/types/footerStyling';
import { FooterStylingDialog } from './FooterStylingDialog';
import { socialIconUrls } from '@/utils/socialIcons';

interface FooterBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
  campaignId?: string;
  footerBackgroundColor?: string;
  onFooterColorChange?: (color: string | undefined) => void;
  onFooterStylingChange?: (styling: FooterStyling) => void;
}

// PNG social icons from Supabase Storage
const SocialIcon: React.FC<{ platform: string; className?: string }> = ({ platform, className }) => {
  const iconUrl = socialIconUrls[platform as keyof typeof socialIconUrls];
  if (!iconUrl) return null;
  
  return (
    <img 
      src={iconUrl} 
      alt={platform} 
      width="20" 
      height="20" 
      className={className}
      style={{ display: 'block', border: 0, outline: 'none' }}
    />
  );
};

export const FooterBlock: React.FC<FooterBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview,
  campaignId,
  footerBackgroundColor,
  onFooterColorChange,
  onFooterStylingChange
}) => {
  const [isStylingDialogOpen, setIsStylingDialogOpen] = useState(false);
  const { footerSettings, campaignOverrides, saveFooterStyling } = useFooterSettings(campaignId);
  const { companyInfo } = useCompanyInfo();
  
  // Local state for footer styling when campaign doesn't exist yet
  const [localFooterStyling, setLocalFooterStyling] = useState<FooterStyling>({});

  const handleSaveStyling = async (styling: FooterStyling) => {
    setLocalFooterStyling(styling);
    if (campaignId && saveFooterStyling) {
      await saveFooterStyling(campaignId, styling);
    }
    if (styling.backgroundColor) {
      onFooterColorChange?.(styling.backgroundColor);
    }
    // Notify parent about styling change so email preview can update
    onFooterStylingChange?.(styling);
  };

  // Get footer styling from: 1) campaign metadata, 2) local state
  const footerStyling: FooterStyling = campaignOverrides.footerStyling || localFooterStyling;

  // Get brand footer colors from profile settings
  const brandFooterColors = companyInfo.brandFooterColors;

  // Priority cascade: 1) Campaign footer_styling → 2) Brand footer_colors → 3) White default
  // NOTE: brandPrimaryColor intentionally NOT used - footer defaults to white
  const effectiveBackgroundColor = 
    footerStyling.backgroundColor || 
    brandFooterColors?.backgroundColor || 
    footerBackgroundColor || 
    campaignOverrides.footerBackgroundColor || 
    DEFAULT_FOOTER_COLORS.backgroundColor;
  
  const baseStyles = getFooterStyleConfig(effectiveBackgroundColor, companyInfo.brandPrimaryColor);
  
  // Apply styling with priority cascade: campaign → brand → defaults
  const styles = {
    backgroundColor: footerStyling.backgroundColor || brandFooterColors?.backgroundColor || baseStyles.backgroundColor,
    textPrimary: footerStyling.textColor || brandFooterColors?.textColor || baseStyles.textPrimary,
    textMuted: (footerStyling.textColor || brandFooterColors?.textColor) 
      ? `${footerStyling.textColor || brandFooterColors?.textColor}B3` 
      : baseStyles.textMuted, // 70% opacity
    linkAccent: footerStyling.linkColor || brandFooterColors?.linkColor || baseStyles.linkAccent,
    dividerColor: footerStyling.dividerColor || brandFooterColors?.dividerColor || baseStyles.dividerColor,
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

  // Logo colors from styling with priority cascade: campaign → brand → defaults
  const logoBackgroundColor = footerStyling.logoBackgroundColor || brandFooterColors?.logoBackgroundColor || styles.linkAccent;
  const logoTextColor = footerStyling.logoTextColor || brandFooterColors?.logoTextColor || styles.backgroundColor;

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


  if (isPreview) {
    return (
      <div 
        className="relative group w-full mt-10"
        style={{ backgroundColor: styles.backgroundColor }}
      >
        {/* Customize Colors Toolbar */}
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
          {hasFooterStylingOverrides(footerStyling) && (
            <>
              <div className="w-px h-4 bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  // Reset to brand colors from profile instead of clearing completely
                  const brandFooterColors = companyInfo.brandFooterColors;
                  const resetStyling: FooterStyling = brandFooterColors ? {
                    backgroundColor: brandFooterColors.backgroundColor,
                    textColor: brandFooterColors.textColor,
                    linkColor: brandFooterColors.linkColor,
                    dividerColor: brandFooterColors.dividerColor,
                    logoBackgroundColor: brandFooterColors.logoBackgroundColor,
                    logoTextColor: brandFooterColors.logoTextColor,
                  } : {};
                  
                  setLocalFooterStyling(resetStyling);
                  if (campaignId && saveFooterStyling) {
                    await saveFooterStyling(campaignId, resetStyling);
                  }
                  onFooterColorChange?.(resetStyling.backgroundColor);
                  onFooterStylingChange?.(resetStyling);
                }}
                className="h-7 px-2 text-xs text-muted-foreground"
                title="Reset to brand colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

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
      </div>
    );
  }

  // Editor view
  return (
    <div className="relative group py-8">
      {/* Customize Colors Toolbar */}
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
        {hasFooterStylingOverrides(footerStyling) && (
          <>
            <div className="w-px h-4 bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setLocalFooterStyling({});
                if (campaignId && saveFooterStyling) {
                  await saveFooterStyling(campaignId, {});
                }
                onFooterColorChange?.(undefined);
              }}
              className="h-7 px-2 text-xs text-muted-foreground"
              title="Reset to default colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

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
