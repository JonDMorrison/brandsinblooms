import { supabase } from '@/integrations/supabase/client';

interface EmailConsentCheckResult {
  hasConsent: boolean;
  blockedEmails: string[];
  allowedEmails: string[];
  errorCode?: number;
  errorMessage?: string;
}

export class EmailConsentChecker {
  /**
   * Email consent checking is now disabled - all emails are allowed.
   * This method returns all emails as allowed without checking opt-in status.
   */
  static async checkEmails(emails: string[]): Promise<EmailConsentCheckResult> {
    // Consent checking disabled - allow all emails
    return {
      hasConsent: true,
      blockedEmails: [],
      allowedEmails: emails
    };
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
