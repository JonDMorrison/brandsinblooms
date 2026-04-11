import { supabase } from "@/integrations/supabase/client";
import { formatPhoneForTwilio } from "@/lib/utils/phoneFormatter";

interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string;
  mediaUrls?: string[];
}

interface SMSResponse {
  sid?: string;
  status?: string;
  error_code?: string;
  message?: string;
}

/**
 * SMS Client - sends messages via Mobile Text Alerts API through the send-sms edge function
 */
export class SMSClient {
  private static instance: SMSClient;

  private constructor() {}

  static getInstance(): SMSClient {
    if (!SMSClient.instance) {
      SMSClient.instance = new SMSClient();
    }
    return SMSClient.instance;
  }

  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
    try {
      // Format phone number to E.164 before sending
      const formattedPhone = formatPhoneForTwilio(message.to);
      // Call the send-sms edge function (now uses Mobile Text Alerts)
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: formattedPhone,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mediaUrls: message.mediaUrls,
        },
      });

      if (error) {
        console.error("Error calling send-sms function:", error);
        throw new Error(`SMS send failed: ${error.message}`);
      }
      return data as SMSResponse;
    } catch (error) {
      console.error("SMSClient error:", error);
      throw error;
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResponse[]> {
    const results: SMSResponse[] = [];

    // Send messages in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const batchPromises = batch.map((message) => this.sendSMS(message));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.error(`Failed to send SMS ${i + index}:`, result.reason);
          results.push({
            error_code: "SEND_FAILED",
            message: result.reason?.message || "Unknown error",
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

export const smsClient = SMSClient.getInstance();

// Backwards compatibility exports
export const twilioClient = smsClient;
export const TwilioClient = SMSClient;
