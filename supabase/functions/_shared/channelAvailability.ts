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
 * Check if SMS channel is available by verifying Twilio credentials
 */
export function checkSMSAvailability(): ChannelStatus {
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    const missing: string[] = [];
    if (!twilioAccountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!twilioAuthToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!twilioPhoneNumber) missing.push('TWILIO_PHONE_NUMBER');
    
    return {
      available: false,
      reason: `Twilio not configured. Missing: ${missing.join(', ')}`
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
