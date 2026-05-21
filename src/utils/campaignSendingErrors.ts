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
  | 'SENDER_DOMAIN_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'DOMAIN_NON_COMPLIANT_FOR_SCALE'
  | 'DOMAIN_BLOCKED'
  | 'PROTECTED_SEND_ACTIVE'
  | 'SEND_PAUSED_BY_ADMIN'
  | 'HIGH_VOLUME_REVIEW_REQUIRED'
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
    description: "There are no eligible opted-in contacts to email after BloomSuite applied consent and suppression checks.",
    action: "Review your audience, import contacts with consent, or check skipped contacts for details.",
    recoverable: true
  },
  EMAIL_SERVICE_NOT_CONFIGURED: {
    title: "Email service not configured",
    description: "The email service is not configured properly.",
    action: "Please contact support to configure email sending.",
    recoverable: false
  },
  SENDER_DOMAIN_REQUIRED: {
    title: "Sender domain required",
    description: "Campaign sending requires a configured custom sending domain.",
    action: "Go to Email Settings to configure and verify your sending domain, then try again.",
    recoverable: true
  },
  QUOTA_EXCEEDED: {
    title: "Sending limit reached",
    description: "This campaign is larger than the current sending limit for this account or domain.",
    action: "Try a smaller audience or contact support to review the sending limit.",
    recoverable: true
  },
  DOMAIN_NON_COMPLIANT_FOR_SCALE: {
    title: "Review needed before high-volume send",
    description: "This campaign is large enough that BloomSuite needs a few sender details cleaned up before sending safely.",
    action: "Fix the items shown in Email Settings or reduce the audience size and send again.",
    recoverable: true
  },
  DOMAIN_BLOCKED: {
    title: "Sending paused for this domain",
    description: "This sending domain is paused or blocked and needs support review before more campaigns can send.",
    action: "Review your domain health in Email Settings or contact support.",
    recoverable: false
  },
  PROTECTED_SEND_ACTIVE: {
    title: "Protected Send is active",
    description: "BloomSuite will send this campaign more gradually to protect inbox placement.",
    action: "No action is required. The campaign can continue with protected pacing.",
    recoverable: true
  },
  SEND_PAUSED_BY_ADMIN: {
    title: "Campaign sending is paused",
    description: "This campaign was paused by an admin or support rule before sending.",
    action: "Review the campaign status or contact support if you believe this is incorrect.",
    recoverable: true
  },
  HIGH_VOLUME_REVIEW_REQUIRED: {
    title: "Review needed before high-volume send",
    description: "This high-volume campaign needs a few deliverability checks resolved before sending.",
    action: "Review the highlighted sender, content, or business-address items, then try again.",
    recoverable: true
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
export function parseEdgeFunctionError(error: any, responseData?: any): SendError {
  const message = error?.message || error?.toString() || '';
  const data = responseData || {};

  const reason = typeof data?.reason === 'string' ? data.reason : '';
  const bodyError = typeof data?.error === 'string' ? data.error : '';
  const reputationAction = typeof data?.reputation?.action === 'string' ? data.reputation.action : '';

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

  if (
    reason === 'sender_domain_required' ||
    reason === 'shared_sender_disabled' ||
    bodyError.includes('custom domain sender') ||
    message.includes('custom domain sender') ||
    message.includes('sender domain')
  ) {
    return { code: 'SENDER_DOMAIN_REQUIRED', ...SEND_ERRORS.SENDER_DOMAIN_REQUIRED };
  }

  if (reason === 'admin_paused' || reason === 'force_stopped' || message.includes('Campaign is paused')) {
    return { code: 'SEND_PAUSED_BY_ADMIN', ...SEND_ERRORS.SEND_PAUSED_BY_ADMIN };
  }

  if (
    reason === 'reputation_critical_autopause' ||
    reputationAction === 'pause' ||
    message.includes('auto-paused')
  ) {
    return {
      code: 'SEND_PAUSED_BY_ADMIN',
      ...SEND_ERRORS.SEND_PAUSED_BY_ADMIN,
      description: bodyError || message || SEND_ERRORS.SEND_PAUSED_BY_ADMIN.description,
    };
  }

  if (
    reason === 'reputation_restricted' ||
    reputationAction === 'throttle' ||
    message.includes('restricted tier')
  ) {
    return { code: 'PROTECTED_SEND_ACTIVE', ...SEND_ERRORS.PROTECTED_SEND_ACTIVE };
  }

  if (message.includes('no segments selected') || message.includes('Campaign has no segments')) {
    return { code: 'NO_SEGMENTS', ...SEND_ERRORS.NO_SEGMENTS };
  }

  if (message.includes('No customers found') ||
      message.includes('No eligible recipients') ||
      message.includes('No contacts found') ||
      message.includes('no opted-in') ||
      message.includes('have not opted in') ||
      message.includes('No opted-in recipients')) {
    return { code: 'NO_OPTED_IN_CUSTOMERS', ...SEND_ERRORS.NO_OPTED_IN_CUSTOMERS };
  }

  if (message.includes('quota') || message.includes('limit reached') || message.includes('Send blocked')) {
    return { code: 'QUOTA_EXCEEDED', ...SEND_ERRORS.QUOTA_EXCEEDED };
  }

  if (
    reason === 'compliance_not_met_for_scale' ||
    message.includes('domain_not_compliant_for_scale') ||
    message.includes('High-volume sending blocked') ||
    message.includes('requires SPF, DKIM, DMARC')
  ) {
    return { code: 'HIGH_VOLUME_REVIEW_REQUIRED', ...SEND_ERRORS.HIGH_VOLUME_REVIEW_REQUIRED };
  }

  if (
    reason === 'domain_blocked' ||
    reason === 'domain_paused' ||
    bodyError.includes('domain has been blocked') ||
    message.includes('domain has been blocked')
  ) {
    return { code: 'DOMAIN_BLOCKED', ...SEND_ERRORS.DOMAIN_BLOCKED };
  }

  if (message.includes('Failed to fetch') || message.includes('Network') || message.includes('ECONNREFUSED')) {
    return { code: 'NETWORK_ERROR', ...SEND_ERRORS.NETWORK_ERROR };
  }

  // Default unknown error with original message
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Send failed',
    description: bodyError || message || SEND_ERRORS.UNKNOWN_ERROR.description,
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
  const { campaignName, subjectLine, blocks, content } = params;

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