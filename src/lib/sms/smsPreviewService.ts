import { supabase } from '@/integrations/supabase/client';

export interface SampleCustomer {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  custom?: Record<string, unknown>;
}

export interface RenderPreviewRequest {
  tenantId?: string;
  campaignId?: string;
  messageTemplate?: string;
  mediaUrls?: string[];
  customerId?: string;
  sampleCustomer?: SampleCustomer;
}

export interface SegmentInfo {
  encoding: 'GSM-7' | 'UCS-2';
  segments: number;
  length: number;
  perSegment: number;
  isMultipart: boolean;
}

export interface MmsInfo {
  isMms: boolean;
  mediaUrls: string[];
}

export interface MergeMeta {
  usedTags: string[];
  missingTags: string[];
}

export interface RenderPreviewResponse {
  success: boolean;
  renderedText: string;
  mergeMeta: MergeMeta;
  segmentInfo: SegmentInfo;
  mms: MmsInfo;
  error?: string;
}

export interface SendTestRequest {
  campaignId?: string;
  messageTemplate?: string;
  mediaUrls?: string[];
  testToPhone: string;
  renderAsCustomerId?: string;
  bypassConsentForTest?: boolean;
}

export interface SendTestResponse {
  success: boolean;
  twilioSid?: string;
  status?: string;
  to?: string;
  renderedMessage?: string;
  error?: string;
  twilioError?: string;
  code?: string;
}

/**
 * Render SMS preview with merge tags
 */
export async function renderSmsPreview(request: RenderPreviewRequest): Promise<RenderPreviewResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('sms-render-preview', {
      body: request,
    });

    if (error) {
      console.error('[smsPreviewService] Render preview error:', error);
      return {
        success: false,
        renderedText: '',
        mergeMeta: { usedTags: [], missingTags: [] },
        segmentInfo: { encoding: 'GSM-7', segments: 1, length: 0, perSegment: 160, isMultipart: false },
        mms: { isMms: false, mediaUrls: [] },
        error: error.message,
      };
    }

    return data as RenderPreviewResponse;
  } catch (err) {
    console.error('[smsPreviewService] Unexpected error:', err);
    return {
      success: false,
      renderedText: '',
      mergeMeta: { usedTags: [], missingTags: [] },
      segmentInfo: { encoding: 'GSM-7', segments: 1, length: 0, perSegment: 160, isMultipart: false },
      mms: { isMms: false, mediaUrls: [] },
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send test SMS message
 */
export async function sendTestSms(request: SendTestRequest): Promise<SendTestResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('sms-send-test', {
      body: request,
    });

    if (error) {
      console.error('[smsPreviewService] Send test error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return data as SendTestResponse;
  } catch (err) {
    console.error('[smsPreviewService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
