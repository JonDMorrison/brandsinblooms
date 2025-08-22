import { supabase } from '@/integrations/supabase/client';

// Types for different test email scenarios
export interface SenderTestPayload {
  senderId: string;
  testEmail: string;
}

export interface CampaignTestPayload {
  email: string;
  subject: string;
  content: string;
  campaignId?: string;
  testName?: string;
}

export interface DomainTestPayload {
  domain: string;
  testEmail: string;
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}

// Shared error messages for better UX
export const ERROR_MESSAGES = {
  EMAIL_REQUIRED: 'Please enter a valid email address',
  EMAIL_SERVICE_UNAVAILABLE: 'Email service is currently unavailable. Please try again later.',
  SENDER_NOT_CONFIGURED: 'Email sender not configured. Please set up your email sender first.',
  SENDER_NOT_VERIFIED: 'Email sender is not verified. Please verify your email domain.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Send a test email for a campaign
 */
export async function sendCampaignTestEmail(payload: CampaignTestPayload): Promise<TestEmailResponse> {
  try {
    console.log('📧 Sending campaign test email:', { 
      email: payload.email, 
      subject: payload.subject,
      campaignId: payload.campaignId 
    });

    const { data, error } = await supabase.functions.invoke('send-test-email', {
      body: payload
    });

    if (error) {
      console.error('📧 Campaign test email error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('Email service not configured')) {
        return { success: false, message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE, error: error.message };
      }
      if (error.message?.includes('not verified')) {
        return { success: false, message: ERROR_MESSAGES.SENDER_NOT_VERIFIED, error: error.message };
      }
      if (error.message?.includes('not found')) {
        return { success: false, message: ERROR_MESSAGES.SENDER_NOT_CONFIGURED, error: error.message };
      }
      
      return { success: false, message: ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
    }

    return {
      success: true,
      message: `Test email sent successfully to ${payload.email}`,
      emailId: data?.emailId
    };

  } catch (error: any) {
    console.error('📧 Campaign test email exception:', error);
    
    if (error.name === 'NetworkError' || !navigator.onLine) {
      return { success: false, message: ERROR_MESSAGES.NETWORK_ERROR, error: error.message };
    }
    
    return { success: false, message: ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
  }
}

/**
 * Send a test email for email sender configuration
 */
export async function sendSenderTestEmail(payload: SenderTestPayload): Promise<TestEmailResponse> {
  try {
    console.log('📧 Sending sender test email:', { senderId: payload.senderId, email: payload.testEmail });

    const { data, error } = await supabase.functions.invoke('send-test-email', {
      body: payload
    });

    if (error) {
      console.error('📧 Sender test email error:', error);
      return { success: false, message: error.message || ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
    }

    return {
      success: true,
      message: `Test email sent successfully to ${payload.testEmail}`,
      emailId: data?.emailId
    };

  } catch (error: any) {
    console.error('📧 Sender test email exception:', error);
    return { success: false, message: ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
  }
}

/**
 * Send a test email for domain configuration
 */
export async function sendDomainTestEmail(payload: DomainTestPayload): Promise<TestEmailResponse> {
  try {
    console.log('📧 Sending domain test email:', { domain: payload.domain, email: payload.testEmail });

    const { data, error } = await supabase.functions.invoke('send-test-email', {
      body: payload
    });

    if (error) {
      console.error('📧 Domain test email error:', error);
      return { success: false, message: error.message || ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
    }

    return {
      success: true,
      message: `Domain test email sent successfully to ${payload.testEmail}`,
      emailId: data?.emailId
    };

  } catch (error: any) {
    console.error('📧 Domain test email exception:', error);
    return { success: false, message: ERROR_MESSAGES.UNKNOWN_ERROR, error: error.message };
  }
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}