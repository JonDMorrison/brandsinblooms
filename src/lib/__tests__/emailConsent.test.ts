import { describe, it, expect } from 'vitest';
import { 
  getEmailConsentStatus, 
  getConsentStatusLabel,
  getConsentStatusColor 
} from '../crm/emailConsent';

describe('Email Consent Helper Functions', () => {
  describe('getEmailConsentStatus', () => {
    it('returns "opted_in" when email_opt_in is true', () => {
      expect(getEmailConsentStatus({ email_opt_in: true })).toBe('opted_in');
    });

    it('returns "opted_out" when email_opt_in is false', () => {
      expect(getEmailConsentStatus({ email_opt_in: false })).toBe('opted_out');
    });

    it('returns "unknown" when email_opt_in is null', () => {
      expect(getEmailConsentStatus({ email_opt_in: null })).toBe('unknown');
    });

    it('returns "unknown" when email_opt_in is undefined (coerced to null)', () => {
      // TypeScript type says boolean | null, but runtime could have undefined
      expect(getEmailConsentStatus({ email_opt_in: undefined as unknown as null })).toBe('unknown');
    });
  });

  describe('getConsentStatusLabel', () => {
    it('returns "Opted In" for opted_in status', () => {
      expect(getConsentStatusLabel('opted_in')).toBe('Opted In');
    });

    it('returns "Opted Out" for opted_out status', () => {
      expect(getConsentStatusLabel('opted_out')).toBe('Opted Out');
    });

    it('returns "Unknown" for unknown status', () => {
      expect(getConsentStatusLabel('unknown')).toBe('Unknown');
    });
  });

  describe('getConsentStatusColor', () => {
    it('returns "default" (green) for opted_in', () => {
      expect(getConsentStatusColor('opted_in')).toBe('default');
    });

    it('returns "destructive" (red) for opted_out', () => {
      expect(getConsentStatusColor('opted_out')).toBe('destructive');
    });

    it('returns "secondary" (yellow/neutral) for unknown', () => {
      expect(getConsentStatusColor('unknown')).toBe('secondary');
    });
  });

  describe('Tri-state consent business rules', () => {
    it('differentiates between no consent and explicit opt-out', () => {
      const noConsent = getEmailConsentStatus({ email_opt_in: null });
      const optedOut = getEmailConsentStatus({ email_opt_in: false });
      
      expect(noConsent).toBe('unknown');
      expect(optedOut).toBe('opted_out');
      expect(noConsent).not.toBe(optedOut);
    });

    it('only opted_in customers should receive marketing', () => {
      const canReceiveMarketing = (customer: { email_opt_in: boolean | null }) => {
        return getEmailConsentStatus(customer) === 'opted_in';
      };

      expect(canReceiveMarketing({ email_opt_in: true })).toBe(true);
      expect(canReceiveMarketing({ email_opt_in: false })).toBe(false);
      expect(canReceiveMarketing({ email_opt_in: null })).toBe(false);
    });
  });
});
