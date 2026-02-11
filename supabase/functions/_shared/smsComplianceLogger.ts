/**
 * SMS Compliance Logger
 * 
 * Logs compliance events (STOP, START, HELP, carrier errors) to both
 * sms_compliance_events and compliance_logs tables for comprehensive tracking.
 */

import { createClient } from "npm:@supabase/supabase-js@2.7.1";

export type ComplianceEventType = 
  | 'STOP' 
  | 'START' 
  | 'HELP' 
  | 'CARRIER_OPT_OUT'
  | 'A2P_10DLC_ERROR'
  | 'CARRIER_FILTERING'
  | 'INVALID_NUMBER'
  | 'SPAM_DETECTION'
  | 'CONTENT_REJECTION';

export interface ComplianceEvent {
  tenantId?: string;
  customerId?: string;
  phone: string;
  eventType: ComplianceEventType;
  messageContent?: string;
  source?: 'inbound_sms' | 'twilio_callback' | 'worker' | 'manual';
  twilioSid?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a compliance event to both tables
 */
export async function logComplianceEvent(
  supabase: ReturnType<typeof createClient>,
  event: ComplianceEvent
): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Log to sms_compliance_events (new detailed table)
    await supabase
      .from('sms_compliance_events')
      .insert({
        tenant_id: event.tenantId || null,
        customer_id: event.customerId || null,
        phone: event.phone,
        event_type: event.eventType,
        message_content: event.messageContent || null,
        source: event.source || 'worker',
        twilio_sid: event.twilioSid || null,
        metadata: {
          error_code: event.errorCode,
          error_message: event.errorMessage,
          ...event.metadata,
        },
        created_at: now,
      });

    // Also log to compliance_logs for backward compatibility
    if (event.tenantId) {
      await supabase
        .from('compliance_logs')
        .insert({
          tenant_id: event.tenantId,
          msisdn: event.phone,
          event_type: mapEventTypeToComplianceLog(event.eventType),
          message_content: event.messageContent || null,
          meta: {
            error_code: event.errorCode,
            error_message: event.errorMessage,
            source: event.source,
            twilio_sid: event.twilioSid,
            ...event.metadata,
          },
          created_at: now,
          user_id: event.customerId || null,
        });
    }

    console.log(`[sms-compliance] Logged ${event.eventType} for ${event.phone}`);
  } catch (error) {
    console.error(`[sms-compliance] Failed to log event:`, error);
  }
}

/**
 * Map our event types to compliance_logs format
 */
function mapEventTypeToComplianceLog(eventType: ComplianceEventType): string {
  const mapping: Record<ComplianceEventType, string> = {
    'STOP': 'sms_opt_out',
    'START': 'sms_opt_in',
    'HELP': 'sms_help_request',
    'CARRIER_OPT_OUT': 'carrier_opt_out',
    'A2P_10DLC_ERROR': 'a2p_10dlc_error',
    'CARRIER_FILTERING': 'carrier_filtering',
    'INVALID_NUMBER': 'invalid_number',
    'SPAM_DETECTION': 'spam_detection',
    'CONTENT_REJECTION': 'content_rejection',
  };
  return mapping[eventType] || eventType.toLowerCase();
}

/**
 * Classify Twilio error code to compliance event type
 */
export function classifyErrorToComplianceType(errorCode: string | null): ComplianceEventType | null {
  if (!errorCode) return null;

  const code = String(errorCode);

  // A2P 10DLC related
  if (['30034', '30035'].includes(code)) {
    return 'A2P_10DLC_ERROR';
  }

  // Opt-out related
  if (['21610', '63006', '63007'].includes(code)) {
    return 'CARRIER_OPT_OUT';
  }

  // Invalid number
  if (['21211', '21214', '21217', '21612', '21614', '30003', '30006'].includes(code)) {
    return 'INVALID_NUMBER';
  }

  // Carrier filtering / spam
  if (['30005', '30022'].includes(code)) {
    return 'CARRIER_FILTERING';
  }

  // Spam detection
  if (['30004'].includes(code)) {
    return 'SPAM_DETECTION';
  }

  // Content rejection
  if (['30007', '21617'].includes(code)) {
    return 'CONTENT_REJECTION';
  }

  return null;
}
