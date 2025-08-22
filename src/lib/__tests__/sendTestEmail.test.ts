import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCampaignTestEmail, sendSenderTestEmail, sendDomainTestEmail, isValidEmail } from '../sendTestEmail';

// Mock Supabase
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke
    }
  }
}));

describe('sendTestEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test.example.com')).toBe(false);
    });
  });

  describe('sendCampaignTestEmail', () => {
    it('should send campaign test email successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: { emailId: 'test-id-123' },
        error: null
      });

      const payload = {
        email: 'test@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>',
        campaignId: 'campaign-123'
      };

      const result = await sendCampaignTestEmail(payload);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test email sent successfully to test@example.com');
      expect(result.emailId).toBe('test-id-123');
      expect(mockInvoke).toHaveBeenCalledWith('send-test-email', { body: payload });
    });

    it('should handle email service unavailable error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Email service not configured' }
      });

      const payload = {
        email: 'test@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>'
      };

      const result = await sendCampaignTestEmail(payload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email service is currently unavailable. Please try again later.');
    });

    it('should handle network errors', async () => {
      mockInvoke.mockRejectedValue(new Error('NetworkError'));

      const payload = {
        email: 'test@example.com',
        subject: 'Test Subject',
        content: '<h1>Test Content</h1>'
      };

      const result = await sendCampaignTestEmail(payload);

      expect(result.success).toBe(false);
      expect(result.message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('sendSenderTestEmail', () => {
    it('should send sender test email successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: { emailId: 'sender-test-id' },
        error: null
      });

      const payload = {
        senderId: 'sender-123',
        testEmail: 'test@example.com'
      };

      const result = await sendSenderTestEmail(payload);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test email sent successfully to test@example.com');
      expect(mockInvoke).toHaveBeenCalledWith('send-test-email', { body: payload });
    });
  });

  describe('sendDomainTestEmail', () => {
    it('should send domain test email successfully', async () => {
      mockInvoke.mockResolvedValue({
        data: { emailId: 'domain-test-id' },
        error: null
      });

      const payload = {
        domain: 'example.com',
        testEmail: 'test@example.com'
      };

      const result = await sendDomainTestEmail(payload);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Domain test email sent successfully to test@example.com');
      expect(mockInvoke).toHaveBeenCalledWith('send-test-email', { body: payload });
    });
  });
});