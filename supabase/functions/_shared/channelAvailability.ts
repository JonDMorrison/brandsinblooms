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
    deliveryMethod?: 'custom_domain' | 'shared_sender' | 'fallback';
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
 * Email is always available because we have fallback senders
 */
export function checkEmailAvailability(): ChannelStatus & { deliveryMethod?: string } {
  // Email always has a fallback, so it's always available
  return {
    available: true,
    deliveryMethod: 'fallback'
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
