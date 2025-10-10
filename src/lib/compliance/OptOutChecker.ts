import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  phone: string;
  opt_out: boolean;
  sms_opt_in: boolean;
  email_opt_in?: boolean;
}

interface OptOutCheckResult {
  isOptedOut: boolean;
  blockedNumbers: string[];
  allowedNumbers: string[];
  errorCode?: number;
  errorMessage?: string;
}

export class OptOutChecker {
  static async checkPhoneNumbers(phoneNumbers: string[]): Promise<OptOutCheckResult> {
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('id, phone, opt_out, sms_opt_in, email_opt_in')
        .in('phone', phoneNumbers);

      if (error) {
        console.error('Failed to check opt-out status:', error);
        return {
          isOptedOut: false,
          blockedNumbers: [],
          allowedNumbers: phoneNumbers,
          errorCode: 500,
          errorMessage: 'Failed to verify opt-out status'
        };
      }

      const blockedNumbers: string[] = [];
      const allowedNumbers: string[] = [];

      for (const phone of phoneNumbers) {
        const customer = customers?.find(c => c.phone === phone);
        
        if (customer && (customer.opt_out || !customer.sms_opt_in)) {
          blockedNumbers.push(phone);
        } else {
          allowedNumbers.push(phone);
        }
      }

      const hasOptedOutNumbers = blockedNumbers.length > 0;

      return {
        isOptedOut: hasOptedOutNumbers,
        blockedNumbers,
        allowedNumbers,
        errorCode: hasOptedOutNumbers ? 451 : undefined,
        errorMessage: hasOptedOutNumbers 
          ? `Blocked ${blockedNumbers.length} opted-out number(s): ${blockedNumbers.join(', ')}`
          : undefined
      };
    } catch (error) {
      console.error('Error in opt-out check:', error);
      return {
        isOptedOut: false,
        blockedNumbers: [],
        allowedNumbers: phoneNumbers,
        errorCode: 500,
        errorMessage: 'Internal error during opt-out verification'
      };
    }
  }

  static async checkSingleNumber(phoneNumber: string): Promise<boolean> {
    const result = await this.checkPhoneNumbers([phoneNumber]);
    return result.isOptedOut;
  }

  static async updateOptOutStatus(
    phoneNumber: string, 
    optOut: boolean,
    source: 'keyword' | 'manual' | 'complaint' = 'manual'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('crm_customers')
        .update({ 
          opt_out: optOut,
          sms_opt_in: !optOut,
          updated_at: new Date().toISOString()
        })
        .eq('phone', phoneNumber);

      if (error) {
        console.error('Failed to update opt-out status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating opt-out status:', error);
      return false;
    }
  }

  static formatOptOutConfirmation(brandName?: string): string {
    return `You've been opted out and will no longer receive texts from ${brandName || 'us'}.`;
  }

  static formatOptInConfirmation(brandName?: string): string {
    return `Welcome back! You've been re-subscribed to messages from ${brandName || 'us'}. Reply STOP to opt out anytime.`;
  }
}