/**
 * Format phone number to E.164 format for Twilio
 * Handles US/Canada phone numbers by adding +1 country code
 */
export function formatPhoneForTwilio(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If already has country code (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If 10 digit US/Canada number
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If original phone starts with + and has valid length, return as-is
  if (phone.startsWith('+') && cleaned.length >= 10) {
    return phone;
  }
  
  // Default: assume US/Canada and prepend +1
  return `+1${cleaned}`;
}

/**
 * Format phone number for display in UI
 * Converts to (XXX) XXX-XXXX format for US/Canada numbers
 */
export function displayPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle 10-digit US/Canada numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Handle 11-digit numbers starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return original if format not recognized
  return phone;
}
