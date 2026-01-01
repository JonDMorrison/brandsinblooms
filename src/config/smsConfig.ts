/**
 * BloomSuite SMS Program Configuration
 * Brand constants for Twilio 10DLC compliance pages
 */
export const SMS_BRAND_CONFIG = {
  brand_name: 'BloomSuite',
  legal_name: 'Brands in Blooms Consulting Inc.',
  website_url: 'https://bloomsuite.app',
  support_email: 'support@bloomsuite.app',
  support_phone: '', // Leave blank unless staffed
  message_frequency_text: 'up to 4/mo',
  opt_in_keyword_primary: 'JOIN',
  program_number: import.meta.env.VITE_SMS_PROGRAM_NUMBER || null,
  terms_url: 'https://bloomsuite.app/terms',
  privacy_url: 'https://bloomsuite.app/privacy',
  contact_url: 'https://bloomsuite.app/contact',
  sms_page_url: 'https://bloomsuite.app/sms',
  support_hours: 'Mon–Fri 9am–5pm PT',
} as const;

/**
 * Get the display text for the program number
 * Shows "(number to be announced)" if not configured
 */
export function getProgramNumberDisplay(): string {
  return SMS_BRAND_CONFIG.program_number || '(number to be announced)';
}

/**
 * Check if the program number is configured
 */
export function isProgramNumberConfigured(): boolean {
  return !!SMS_BRAND_CONFIG.program_number;
}
