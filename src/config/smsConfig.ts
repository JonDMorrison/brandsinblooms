/**
 * BloomSuite SMS Program Configuration
 * Brand constants for Twilio Toll-Free compliance pages
 */
export const SMS_BRAND_CONFIG = {
  brand_name: 'BloomSuite',
  legal_name: 'Brands in Blooms Consulting Inc.',
  website_url: 'https://bloomsuite.app',
  support_email: 'support@bloomsuite.app',
  support_phone: '', // Leave blank unless staffed
  message_frequency_text: 'typically 1–4 messages per month',
  program_number: import.meta.env.VITE_SMS_PROGRAM_NUMBER || null,
  terms_url: 'https://bloomsuite.app/terms',
  privacy_url: 'https://bloomsuite.app/privacy',
  contact_url: 'https://bloomsuite.app/contact',
  sms_page_url: 'https://bloomsuite.app/sms-program',
  support_hours: 'Mon–Fri 9am–5pm PT',
  // Static date for Twilio verification review
  last_updated: 'January 5, 2025',
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
