/**
 * Email Footer Renderer
 * Generates HTML for email footers with brand-aware styling
 * 
 * This is the legacy renderer - kept for backward compatibility.
 * New implementations should use generateNewsletterFooterHtml from newsletterFooterHtml.ts
 */

import { processEmailTokens, TokenData } from './emailTokenProcessor';
import { generateNewsletterFooterHtml } from './newsletterFooterHtml';
import { NewsletterFooterProps } from '@/types/newsletterFooter';

interface FooterSettings {
  showPhone: boolean;
  showLogo: boolean;
  showManagePreferences: boolean;
  padding: 'compact' | 'normal' | 'spacious';
  alignment: 'left' | 'center';
  showDivider: boolean;
  backgroundColor: 'light' | 'dark' | 'white';
  fontSize: 'xs' | 'sm';
  complianceText: string;
  customFooterText?: string;
  // Extended fields
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  websiteUrl?: string;
}

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
}

/**
 * Generate footer HTML - enhanced version using new footer system
 */
export const generateFooterHTML = (
  footerSettings: FooterSettings,
  companyInfo: CompanyInfo,
  tokenData?: TokenData,
  footerBackgroundColor?: string
): string => {
  const tokens = tokenData || {
    companyName: companyInfo?.name || 'Your Company',
    companyAddress: companyInfo?.address || '123 Business St, Suite 100, City, State 12345',
    companyPhone: companyInfo?.phone || '(555) 123-4567',
    unsubscribeUrl: '[Unsubscribe Link]',
    managePreferencesUrl: '[Manage Preferences Link]',
  };

  // Check if we have extended footer settings - use new renderer
  const hasExtendedSettings = footerSettings.facebookUrl || 
    footerSettings.instagramUrl || 
    footerSettings.addressLine1 ||
    footerBackgroundColor;

  if (hasExtendedSettings) {
    // Use the new newsletter footer HTML generator
    const footerProps: NewsletterFooterProps = {
      logoUrl: footerSettings.showLogo ? companyInfo?.logoUrl : undefined,
      companyName: tokens.companyName,
      addressLine1: footerSettings.addressLine1 || companyInfo?.address,
      addressLine2: footerSettings.addressLine2,
      city: footerSettings.city,
      region: footerSettings.region,
      postalCode: footerSettings.postalCode,
      country: footerSettings.country,
      websiteUrl: footerSettings.websiteUrl,
      email: footerSettings.email,
      phone: footerSettings.showPhone ? tokens.companyPhone : undefined,
      facebookUrl: footerSettings.facebookUrl,
      instagramUrl: footerSettings.instagramUrl,
      tiktokUrl: footerSettings.tiktokUrl,
      pinterestUrl: footerSettings.pinterestUrl,
      youtubeUrl: footerSettings.youtubeUrl,
      linkedinUrl: footerSettings.linkedinUrl,
      unsubscribeUrl: tokens.unsubscribeUrl || '#',
      managePreferencesUrl: footerSettings.showManagePreferences ? tokens.managePreferencesUrl : undefined,
      legalText: processEmailTokens(footerSettings.complianceText, tokens),
      footerBackgroundColor,
      brandPrimaryColor: companyInfo?.brandPrimaryColor,
    };

    return generateNewsletterFooterHtml(footerProps);
  }

  // Legacy footer rendering for backward compatibility
  const alignment = footerSettings.alignment === 'center' ? 'center' : 'left';
  const bgColor = footerSettings.backgroundColor === 'dark' ? '#283024' : 
                  footerSettings.backgroundColor === 'white' ? '#ffffff' : '#f9fafb';
  const textColor = footerSettings.backgroundColor === 'dark' ? '#F3F4F6' : '#6b7280';
  const linkColor = footerSettings.backgroundColor === 'dark' ? '#E5BFA7' : '#2563EB';
  const fontSize = footerSettings.fontSize === 'xs' ? '11px' : '12px';
  const padding = footerSettings.padding === 'spacious' ? '32px 16px' : 
                  footerSettings.padding === 'compact' ? '16px 16px' : '24px 16px';

  let footerContent = '';

  // Add divider if enabled
  if (footerSettings.showDivider) {
    const dividerColor = footerSettings.backgroundColor === 'dark' ? '#3D4A38' : '#e5e7eb';
    footerContent += `
      <div style="border-top: 1px solid ${dividerColor}; margin: 20px 0;"></div>
    `;
  }

  // Start footer container
  footerContent += `
    <div style="
      background-color: ${bgColor};
      padding: ${padding};
      text-align: ${alignment};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${fontSize};
      color: ${textColor};
      line-height: 1.5;
    ">
  `;

  // Company logo
  if (footerSettings.showLogo && companyInfo?.logoUrl) {
    footerContent += `
      <div style="margin-bottom: 16px;">
        <img src="${companyInfo.logoUrl}" alt="${tokens.companyName}" style="height: 40px; width: auto; object-fit: contain;" />
      </div>
    `;
  }

  // Company info section
  footerContent += `
    <div style="margin-bottom: 16px;">
      <strong style="color: ${footerSettings.backgroundColor === 'dark' ? '#F3F4F6' : '#1f2937'};">${tokens.companyName}</strong>
  `;

  if (tokens.companyAddress) {
    footerContent += `
      <br />${tokens.companyAddress}
    `;
  }

  if (footerSettings.showPhone && tokens.companyPhone) {
    footerContent += `
      <br />Phone: ${tokens.companyPhone}
    `;
  }

  footerContent += `
    </div>
  `;

  // Custom footer text if provided
  if (footerSettings.customFooterText) {
    const processedCustomText = processEmailTokens(footerSettings.customFooterText, tokens);
    footerContent += `
      <div style="margin-bottom: 16px;">
        ${processedCustomText}
      </div>
    `;
  }

  // Compliance notice
  const processedComplianceText = processEmailTokens(footerSettings.complianceText, tokens);
  footerContent += `
    <div style="margin-bottom: 16px; font-size: ${fontSize};">
      ${processedComplianceText}
    </div>
  `;

  // Links section
  footerContent += `
    <div style="margin-bottom: 8px;">
  `;

  const links = [];
  
  if (tokens.unsubscribeUrl) {
    links.push(`<a href="${tokens.unsubscribeUrl}" style="color: ${linkColor}; text-decoration: underline;">Unsubscribe</a>`);
  }

  if (footerSettings.showManagePreferences && tokens.managePreferencesUrl) {
    links.push(`<a href="${tokens.managePreferencesUrl}" style="color: ${linkColor}; text-decoration: underline;">Manage Preferences</a>`);
  }

  if (links.length > 0) {
    footerContent += links.join(` <span style="color: ${textColor}; margin: 0 8px;">|</span> `);
  }

  footerContent += `
    </div>
  `;

  // Close footer container
  footerContent += `
    </div>
  `;

  return footerContent;
};
