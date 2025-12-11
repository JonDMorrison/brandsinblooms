/**
 * Comprehensive error handling for campaign sending flow
 * Maps technical errors to user-friendly messages
 */

export type SendErrorCode = 
  | 'NO_CAMPAIGN_NAME'
  | 'NO_SUBJECT_LINE'
  | 'NO_SEGMENTS'
  | 'NO_CONTENT'
  | 'NO_OPTED_IN_CUSTOMERS'
  | 'EMAIL_SERVICE_NOT_CONFIGURED'
  | 'QUOTA_EXCEEDED'
  | 'DOMAIN_BLOCKED'
  | 'CAMPAIGN_SAVE_FAILED'
  | 'CAMPAIGN_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface SendError {
  code: SendErrorCode;
  title: string;
  description: string;
  action?: string;
  recoverable: boolean;
}

export const SEND_ERRORS: Record<SendErrorCode, Omit<SendError, 'code'>> = {
  NO_CAMPAIGN_NAME: {
    title: "Campaign name required",
    description: "Please enter a campaign name before sending.",
    recoverable: true
  },
  NO_SUBJECT_LINE: {
    title: "Subject line required",
    description: "Please enter a subject line before sending.",
    recoverable: true
  },
  NO_SEGMENTS: {
    title: "No audience selected",
    description: "Campaign has no segments selected. Please select an audience.",
    action: "Select an audience segment in the Audience section.",
    recoverable: true
  },
  NO_CONTENT: {
    title: "No email content",
    description: "Your email has no content blocks. Please add content before sending.",
    recoverable: true
  },
  NO_OPTED_IN_CUSTOMERS: {
    title: "No eligible recipients",
    description: "No customers in the selected segment have opted in to receive emails.",
    action: "Check that customers have email_opt_in enabled or select a different segment.",
    recoverable: true
  },
  EMAIL_SERVICE_NOT_CONFIGURED: {
    title: "Email service not configured",
    description: "The email service (Resend) is not configured properly.",
    action: "Please contact support to configure email sending.",
    recoverable: false
  },
  QUOTA_EXCEEDED: {
    title: "Sending limit reached",
    description: "You've reached your email sending limit for this period.",
    action: "Upgrade your plan or wait until your quota resets.",
    recoverable: false
  },
  DOMAIN_BLOCKED: {
    title: "Domain blocked",
    description: "Your sending domain has been blocked due to high bounce or complaint rates.",
    action: "Review your domain health in Email Settings.",
    recoverable: false
  },
  CAMPAIGN_SAVE_FAILED: {
    title: "Failed to save campaign",
    description: "Could not save your campaign before sending.",
    action: "Check your internet connection and try again.",
    recoverable: true
  },
  CAMPAIGN_NOT_FOUND: {
    title: "Campaign not found",
    description: "The campaign could not be found after saving.",
    action: "Please try creating a new campaign.",
    recoverable: false
  },
  NETWORK_ERROR: {
    title: "Network error",
    description: "Could not connect to the email service.",
    action: "Check your internet connection and try again.",
    recoverable: true
  },
  UNKNOWN_ERROR: {
    title: "Something went wrong",
    description: "An unexpected error occurred while sending your campaign.",
    action: "Please try again or contact support if the issue persists.",
    recoverable: true
  }
};

/**
 * Parse error response from edge function and return user-friendly error
 */
export function parseEdgeFunctionError(error: any): SendError {
  const message = error?.message || error?.toString() || '';
  
  // Check for specific error patterns from send-email-campaign edge function
  if (message.includes('Campaign ID is required')) {
    return { code: 'CAMPAIGN_NOT_FOUND', ...SEND_ERRORS.CAMPAIGN_NOT_FOUND };
  }
  
  if (message.includes('Campaign not found')) {
    return { code: 'CAMPAIGN_NOT_FOUND', ...SEND_ERRORS.CAMPAIGN_NOT_FOUND };
  }
  
  if (message.includes('Email service not configured') || message.includes('RESEND_API_KEY')) {
    return { code: 'EMAIL_SERVICE_NOT_CONFIGURED', ...SEND_ERRORS.EMAIL_SERVICE_NOT_CONFIGURED };
  }
  
  if (message.includes('no segments selected') || message.includes('Campaign has no segments')) {
    return { code: 'NO_SEGMENTS', ...SEND_ERRORS.NO_SEGMENTS };
  }
  
  if (message.includes('No customers found') || message.includes('No eligible recipients')) {
    return { code: 'NO_OPTED_IN_CUSTOMERS', ...SEND_ERRORS.NO_OPTED_IN_CUSTOMERS };
  }
  
  if (message.includes('quota') || message.includes('limit reached') || message.includes('Send blocked')) {
    return { code: 'QUOTA_EXCEEDED', ...SEND_ERRORS.QUOTA_EXCEEDED };
  }
  
  if (message.includes('blocked') || message.includes('paused') || message.includes('reputation')) {
    return { code: 'DOMAIN_BLOCKED', ...SEND_ERRORS.DOMAIN_BLOCKED };
  }
  
  if (message.includes('Failed to fetch') || message.includes('Network') || message.includes('ECONNREFUSED')) {
    return { code: 'NETWORK_ERROR', ...SEND_ERRORS.NETWORK_ERROR };
  }
  
  // Default unknown error with original message
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Send failed',
    description: message || SEND_ERRORS.UNKNOWN_ERROR.description,
    action: SEND_ERRORS.UNKNOWN_ERROR.action,
    recoverable: true
  };
}

/**
 * Pre-send validation to catch errors before hitting the edge function
 */
export interface PreSendValidation {
  valid: boolean;
  error?: SendError;
}

export function validateBeforeSend(params: {
  campaignName: string;
  subjectLine: string;
  segments: Array<{ id: string }>;
  blocks: Array<any>;
  content: string;
}): PreSendValidation {
  const { campaignName, subjectLine, segments, blocks, content } = params;
  
  if (!campaignName?.trim()) {
    return { valid: false, error: { code: 'NO_CAMPAIGN_NAME', ...SEND_ERRORS.NO_CAMPAIGN_NAME } };
  }
  
  if (!subjectLine?.trim()) {
    return { valid: false, error: { code: 'NO_SUBJECT_LINE', ...SEND_ERRORS.NO_SUBJECT_LINE } };
  }
  
  // Check for content
  const hasBlocks = blocks && blocks.length > 0;
  const hasContent = content && content.trim().length > 100; // Minimum content check
  
  if (!hasBlocks && !hasContent) {
    return { valid: false, error: { code: 'NO_CONTENT', ...SEND_ERRORS.NO_CONTENT } };
  }
  
  return { valid: true };
}
