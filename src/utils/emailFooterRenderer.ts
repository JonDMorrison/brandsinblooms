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
}
import { processEmailTokens, TokenData } from './emailTokenProcessor';

export const generateFooterHTML = (
  footerSettings: FooterSettings,
  companyInfo: any,
  tokenData?: TokenData
): string => {
  const tokens = tokenData || {
    companyName: companyInfo?.name || 'Your Company',
    companyAddress: companyInfo?.address || '123 Business St, Suite 100, City, State 12345',
    companyPhone: companyInfo?.phone || '(555) 123-4567',
    unsubscribeUrl: '[Unsubscribe Link]',
    managePreferencesUrl: '[Manage Preferences Link]',
  };

  const alignment = footerSettings.alignment === 'center' ? 'center' : 'left';
  const bgColor = footerSettings.backgroundColor === 'dark' ? '#1f2937' : '#f9fafb';
  const textColor = footerSettings.backgroundColor === 'dark' ? '#ffffff' : '#6b7280';
  const fontSize = footerSettings.fontSize === 'xs' ? '11px' : '12px';
  const padding = footerSettings.padding === 'spacious' ? '32px 16px' : footerSettings.padding === 'compact' ? '16px 16px' : '24px 16px';

  let footerContent = '';

  // Add divider if enabled
  if (footerSettings.showDivider) {
    footerContent += `
      <div style="border-top: 1px solid #e5e7eb; margin: 20px 0;"></div>
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
        <img src="${companyInfo.logoUrl}" alt="${tokens.companyName}" style="height: 32px; width: auto;" />
      </div>
    `;
  }

  // Company info section
  footerContent += `
    <div style="margin-bottom: 16px;">
      <strong>${tokens.companyName}</strong>
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
    links.push(`<a href="${tokens.unsubscribeUrl}" style="color: ${textColor}; text-decoration: underline;">Unsubscribe</a>`);
  }

  if (footerSettings.showManagePreferences && tokens.managePreferencesUrl) {
    links.push(`<a href="${tokens.managePreferencesUrl}" style="color: ${textColor}; text-decoration: underline;">Manage Preferences</a>`);
  }

  if (links.length > 0) {
    footerContent += links.join(' | ');
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