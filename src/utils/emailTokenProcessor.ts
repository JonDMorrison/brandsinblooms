/**
 * Email Token Processor (Legacy Compatibility Layer)
 * 
 * This file provides backward compatibility for older code using the legacy token system.
 * New code should use the unified merge tag engine from @/lib/mergeTagEngine
 */

import { renderMergeTags, createPreviewData, type MergeTagData } from '@/lib/mergeTagEngine';
import { convertLegacyTags } from '@/lib/mergeTagCompatibility';

export interface TokenData {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  unsubscribeUrl?: string;
  managePreferencesUrl?: string;
  customerName?: string;
  customerEmail?: string;
}

/**
 * Convert legacy TokenData to the new MergeTagData format
 */
function convertToMergeTagData(tokenData: TokenData): MergeTagData {
  return {
    first_name: tokenData.customerName?.split(' ')[0],
    last_name: tokenData.customerName?.split(' ').slice(1).join(' '),
    email: tokenData.customerEmail,
    company: {
      name: tokenData.companyName,
      address: tokenData.companyAddress,
      phone: tokenData.companyPhone,
      email: tokenData.companyEmail,
    },
    system: {
      unsubscribe_url: tokenData.unsubscribeUrl,
      preferences_url: tokenData.managePreferencesUrl,
    },
  };
}

/**
 * Process email tokens (legacy function - delegates to new engine)
 * @deprecated Use renderMergeTags from @/lib/mergeTagEngine instead
 */
export const processEmailTokens = (content: string, tokenData: TokenData): string => {
  // First convert any legacy tag syntax to modern syntax
  const normalizedContent = convertLegacyTags(content);
  
  // Convert legacy TokenData to new format
  const mergeData = convertToMergeTagData(tokenData);
  
  // Use the new engine
  return renderMergeTags(normalizedContent, mergeData);
};

/**
 * Get default token data (legacy function)
 * @deprecated Use createPreviewData from @/lib/mergeTagEngine instead
 */
export const getDefaultTokenData = (companyInfo?: any): TokenData => {
  return {
    companyName: companyInfo?.name || 'Your Company',
    companyAddress: companyInfo?.address || '123 Business St, Suite 100, City, State 12345',
    companyPhone: companyInfo?.phone || '(555) 123-4567',
    companyEmail: companyInfo?.emailDomain ? `hello@${companyInfo.emailDomain}` : 'hello@yourcompany.com',
    unsubscribeUrl: '[Unsubscribe Link]',
    managePreferencesUrl: '[Manage Preferences Link]',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
  };
};