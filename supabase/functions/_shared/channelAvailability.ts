/**
 * Channel Availability Checker
 * Checks if Email and SMS channels are configured and ready to send
 */

export interface ChannelStatus {
  available: boolean;
  reason?: string;
}

export interface ChannelAvailability {
  email: ChannelStatus & {
    deliveryMethod?: 'custom_domain';
  };
  sms: ChannelStatus;
}

/**
 * Check if SMS channel is available by verifying Mobile Text Alerts credentials
 */
export function checkSMSAvailability(): ChannelStatus {
  const mtaApiKey = Deno.env.get('MOBILE_TEXT_ALERTS_API_KEY');

  if (!mtaApiKey) {
    return {
      available: false,
      reason: 'Mobile Text Alerts not configured. Missing: MOBILE_TEXT_ALERTS_API_KEY'
    };
  }

  return { available: true };
}

/**
 * Check if Email channel is available
 * Email requires the provider API key; there is no sender fallback.
 */
export function checkEmailAvailability(): ChannelStatus & { deliveryMethod?: string } {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    return {
      available: false,
      reason: 'Email not configured. Missing: RESEND_API_KEY'
    };
  }

  return {
    available: true,
    deliveryMethod: 'custom_domain'
  };
}

/**
 * Check all channel availability
 */
export function checkChannelAvailability(): ChannelAvailability {
  return {
    email: checkEmailAvailability(),
    sms: checkSMSAvailability()
  };
}

/**
 * Check if a specific channel type is available
 */
export function isChannelAvailable(channelType: 'email' | 'sms'): ChannelStatus {
  if (channelType === 'email') {
    return checkEmailAvailability();
  } else if (channelType === 'sms') {
    return checkSMSAvailability();
  }
  return { available: false, reason: `Unknown channel type: ${channelType}` };
}
