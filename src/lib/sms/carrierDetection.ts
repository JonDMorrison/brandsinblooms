// Carrier detection and MMS capability checking
interface CarrierInfo {
  carrier: string
  supportsMms: boolean
  region: string
}

// Known carriers that don't support MMS or have limited support
const MMS_UNSUPPORTED_CARRIERS = [
  // US Carriers with limited MMS support
  'ting',
  'cricket', // Some Cricket plans don't support MMS
  'boost-mobile',
  'republic-wireless',
  'google-fi', // Some Google Fi configurations have MMS issues
  
  // International carriers with limited MMS
  'vodafone-uk-prepaid',
  'three-uk-prepaid',
  'orange-france-prepaid',
  'telus-canada-prepaid',
  
  // MVNO carriers that often have MMS limitations
  'mint-mobile',
  'visible',
  'straight-talk',
  'total-wireless',
  'tracfone',
  'net10'
]

// Phone number patterns that indicate potentially unsupported carriers
const UNSUPPORTED_PATTERNS = [
  // Google Voice numbers (often have MMS issues)
  /^(\+1)?6[0-9]{9}$/, // Many Google Voice numbers start with 6
  
  // Some VoIP services
  /^(\+1)?8[0-9]{9}$/, // Some 8xx numbers are VoIP
]

export function detectCarrier(phoneNumber: string): CarrierInfo {
  // Clean phone number
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '')
  
  // Basic carrier detection based on phone number patterns
  // This is a simplified version - in production you'd use a proper carrier lookup service
  
  if (cleanNumber.startsWith('+1') || cleanNumber.length === 10) {
    // US/Canada numbers
    const areaCode = cleanNumber.slice(-10, -7)
    
    // Some area codes are more likely to be VoIP/unsupported
    const voipAreaCodes = ['800', '888', '877', '866', '855', '844', '833', '822']
    if (voipAreaCodes.includes(areaCode)) {
      return {
        carrier: 'voip-service',
        supportsMms: false,
        region: 'US'
      }
    }
    
    // Check against unsupported patterns
    for (const pattern of UNSUPPORTED_PATTERNS) {
      if (pattern.test(cleanNumber)) {
        return {
          carrier: 'unknown-limited',
          supportsMms: false,
          region: 'US'
        }
      }
    }
    
    // Default for US numbers - assume MMS support
    return {
      carrier: 'us-carrier',
      supportsMms: true,
      region: 'US'
    }
  }
  
  // International numbers - be more conservative
  return {
    carrier: 'international',
    supportsMms: false, // Conservative default for international
    region: 'International'
  }
}

export function canReceiveMms(phoneNumber: string): boolean {
  const carrierInfo = detectCarrier(phoneNumber)
  return carrierInfo.supportsMms
}

export function shouldUseFallback(phoneNumber: string, mediaUrls: string[]): boolean {
  // Always use fallback if no media
  if (!mediaUrls || mediaUrls.length === 0) {
    return false
  }
  
  // Check carrier support
  if (!canReceiveMms(phoneNumber)) {
    return true
  }
  
  // Use fallback for multiple images on potentially problematic carriers
  if (mediaUrls.length > 1) {
    const carrierInfo = detectCarrier(phoneNumber)
    // Be conservative with multiple images for international or unknown carriers
    return carrierInfo.region === 'International' || carrierInfo.carrier.includes('unknown')
  }
  
  return false
}

export function getFallbackMessage(mediaUrls: string[], originalMessage: string): string {
  if (!mediaUrls || mediaUrls.length === 0) {
    return originalMessage
  }
  
  const imageText = mediaUrls.length === 1 
    ? 'View image: ' 
    : `View ${mediaUrls.length} images: `
  
  // For now, just include the first URL
  // In production, you'd implement URL shortening
  const shortUrl = shortenUrl(mediaUrls[0])
  
  return `${originalMessage}\n\n${imageText}${shortUrl}`
}

// Simple URL shortening placeholder
function shortenUrl(url: string): string {
  // In production, integrate with bit.ly, tinyurl, or custom shortener
  // For now, just truncate long URLs
  if (url.length > 50) {
    return url.substring(0, 47) + '...'
  }
  return url
}