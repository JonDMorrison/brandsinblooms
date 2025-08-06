import { supabase } from '@/integrations/supabase/client'

interface SMSMessage {
  to: string
  body: string
  mediaUrl?: string
  mediaUrls?: string[]
}

interface TwilioResponse {
  sid?: string
  status?: string
  error_code?: string
  message?: string
}

export class TwilioClient {
  private static instance: TwilioClient
  
  private constructor() {}
  
  static getInstance(): TwilioClient {
    if (!TwilioClient.instance) {
      TwilioClient.instance = new TwilioClient()
    }
    return TwilioClient.instance
  }

  async sendSMS(message: SMSMessage): Promise<TwilioResponse> {
    try {
      console.log(`Sending SMS to ${message.to}`)
      
      // Call the send-sms edge function
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: message.to,
          body: message.body,
          mediaUrl: message.mediaUrl,
          mediaUrls: message.mediaUrls
        }
      })

      if (error) {
        console.error('Error calling send-sms function:', error)
        throw new Error(`SMS send failed: ${error.message}`)
      }

      console.log('SMS sent successfully:', data)
      return data as TwilioResponse

    } catch (error) {
      console.error('TwilioClient error:', error)
      throw error
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<TwilioResponse[]> {
    const results: TwilioResponse[] = []
    
    // Send messages in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      
      const batchPromises = batch.map(message => this.sendSMS(message))
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error(`Failed to send SMS ${i + index}:`, result.reason)
          results.push({
            error_code: 'SEND_FAILED',
            message: result.reason?.message || 'Unknown error'
          })
        }
      })
      
      // Small delay between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }
}

export const twilioClient = TwilioClient.getInstance()