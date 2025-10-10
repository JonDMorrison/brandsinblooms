import { supabase } from '@/integrations/supabase/client';

interface EmailConsentCheckResult {
  hasConsent: boolean;
  blockedEmails: string[];
  allowedEmails: string[];
  errorCode?: number;
  errorMessage?: string;
}

export class EmailConsentChecker {
  static async checkEmails(emails: string[]): Promise<EmailConsentCheckResult> {
    try {
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('email, email_opt_in')
        .in('email', emails);

      if (error) {
        console.error('Failed to check email consent status:', error);
        return {
          hasConsent: false,
          blockedEmails: [],
          allowedEmails: emails,
          errorCode: 500,
          errorMessage: 'Failed to verify email consent status'
        };
      }

      const blockedEmails: string[] = [];
      const allowedEmails: string[] = [];

      for (const email of emails) {
        const customer = customers?.find(c => c.email === email);
        
        if (customer && !customer.email_opt_in) {
          blockedEmails.push(email);
        } else if (customer && customer.email_opt_in) {
          allowedEmails.push(email);
        } else {
          // Customer not in database - treat as non-consented
          blockedEmails.push(email);
        }
      }

      const hasBlockedEmails = blockedEmails.length > 0;

      return {
        hasConsent: !hasBlockedEmails,
        blockedEmails,
        allowedEmails,
        errorCode: hasBlockedEmails ? 451 : undefined,
        errorMessage: hasBlockedEmails 
          ? `Blocked ${blockedEmails.length} email(s) without consent: ${blockedEmails.join(', ')}`
          : undefined
      };
    } catch (error) {
      console.error('Error in email consent check:', error);
      return {
        hasConsent: false,
        blockedEmails: [],
        allowedEmails: emails,
        errorCode: 500,
        errorMessage: 'Internal error during consent verification'
      };
    }
  }

  static async checkSingleEmail(email: string): Promise<boolean> {
    const result = await this.checkEmails([email]);
    return result.hasConsent;
  }

  static async updateEmailConsent(
    email: string,
    optIn: boolean,
    source: 'confirmed_email' | 'manual' | 'import' = 'manual'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('crm_customers')
        .update({ 
          email_opt_in: optIn,
          email_opt_in_at: optIn ? new Date().toISOString() : null,
          email_consent_source: source,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (error) {
        console.error('Failed to update email consent status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating email consent status:', error);
      return false;
    }
  }
}
