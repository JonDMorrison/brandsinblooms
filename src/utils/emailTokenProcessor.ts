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

export const processEmailTokens = (content: string, tokenData: TokenData): string => {
  let processedContent = content;

  // Company tokens
  if (tokenData.companyName) {
    processedContent = processedContent.replace(/\{\{company\.name\}\}/g, tokenData.companyName);
    processedContent = processedContent.replace(/\{\{company_name\}\}/g, tokenData.companyName);
  }

  if (tokenData.companyAddress) {
    processedContent = processedContent.replace(/\{\{company\.address\}\}/g, tokenData.companyAddress);
    processedContent = processedContent.replace(/\{\{company_address\}\}/g, tokenData.companyAddress);
  }

  if (tokenData.companyPhone) {
    processedContent = processedContent.replace(/\{\{company\.phone\}\}/g, tokenData.companyPhone);
    processedContent = processedContent.replace(/\{\{company_phone\}\}/g, tokenData.companyPhone);
  }

  if (tokenData.companyEmail) {
    processedContent = processedContent.replace(/\{\{company\.email\}\}/g, tokenData.companyEmail);
    processedContent = processedContent.replace(/\{\{company_email\}\}/g, tokenData.companyEmail);
  }

  // Unsubscribe and preference tokens
  if (tokenData.unsubscribeUrl) {
    processedContent = processedContent.replace(/\{\{unsubscribe_url\}\}/g, tokenData.unsubscribeUrl);
    processedContent = processedContent.replace(/\{\{unsubscribe\.url\}\}/g, tokenData.unsubscribeUrl);
  }

  if (tokenData.managePreferencesUrl) {
    processedContent = processedContent.replace(/\{\{manage_preferences_url\}\}/g, tokenData.managePreferencesUrl);
    processedContent = processedContent.replace(/\{\{preferences\.url\}\}/g, tokenData.managePreferencesUrl);
  }

  // Customer tokens
  if (tokenData.customerName) {
    processedContent = processedContent.replace(/\{\{customer\.name\}\}/g, tokenData.customerName);
    processedContent = processedContent.replace(/\{\{customer_name\}\}/g, tokenData.customerName);
  }

  if (tokenData.customerEmail) {
    processedContent = processedContent.replace(/\{\{customer\.email\}\}/g, tokenData.customerEmail);
    processedContent = processedContent.replace(/\{\{customer_email\}\}/g, tokenData.customerEmail);
  }

  return processedContent;
};

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