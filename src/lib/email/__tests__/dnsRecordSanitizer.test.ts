import { describe, it, expect } from 'vitest';
import { 
  sanitizeDnsRecords, 
  validateCanonicalRecords, 
  prepareRecordsForEntri,
  DnsRecord 
} from '../dnsRecordSanitizer';

describe('dnsRecordSanitizer', () => {
  const testDomain = 'example.com';

  describe('sanitizeDnsRecords', () => {
    it('should keep DKIM CNAME and drop DKIM TXT when both exist', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: 'resend._domainkey', value: 'v=DKIM1; k=rsa; p=MIIB...', ttl: 3600 }
      ];

      const result = sanitizeDnsRecords(records, testDomain);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].type).toBe('CNAME');
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0].type).toBe('TXT');
      expect(result.warnings).toContain('Found both DKIM CNAME and TXT records. Keeping CNAME only (Resend canonical).');
    });

    it('should keep only one SPF record', () => {
      const records: DnsRecord[] = [
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'TXT', host: 'example.com', value: 'v=spf1 include:other.com ~all', ttl: 3600 }
      ];

      const result = sanitizeDnsRecords(records, testDomain);

      const spfRecords = result.records.filter(r => r.value.includes('spf'));
      expect(spfRecords).toHaveLength(1);
      expect(spfRecords[0].host).toBe('@');
    });

    it('should keep Return-Path CNAME for send subdomain', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 },
        { type: 'MX', host: 'send', value: 'feedback-smtp.us-east-1.amazonses.com', ttl: 3600 }
      ];

      const result = sanitizeDnsRecords(records, testDomain);

      expect(result.records).toHaveLength(2);
      expect(result.records.find(r => r.type === 'CNAME' && r.host === 'send')).toBeDefined();
      expect(result.records.find(r => r.type === 'MX' && r.host === 'send')).toBeDefined();
    });

    it('should normalize domain suffixes to relative hosts', () => {
      const records: DnsRecord[] = [
        { type: 'TXT', host: 'example.com', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'resend._domainkey.example.com', value: 'resend._domainkey.resend.com', ttl: 3600 }
      ];

      const result = sanitizeDnsRecords(records, testDomain);

      expect(result.records.find(r => r.host === '@')).toBeDefined();
      expect(result.records.find(r => r.host === 'resend._domainkey')).toBeDefined();
    });

    it('should keep only single DKIM selector', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'CNAME', host: 'selector2._domainkey', value: 'selector2._domainkey.resend.com', ttl: 3600 }
      ];

      const result = sanitizeDnsRecords(records, testDomain);

      const dkimRecords = result.records.filter(r => r.host.includes('domainkey'));
      expect(dkimRecords).toHaveLength(1);
    });
  });

  describe('validateCanonicalRecords', () => {
    it('should pass validation with all required records', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 },
        { type: 'TXT', host: '_dmarc', value: 'v=DMARC1; p=quarantine', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasDkim).toBe(true);
      expect(result.details.dkimType).toBe('CNAME');
      expect(result.details.hasSpf).toBe(true);
      expect(result.details.hasMx).toBe(true);
      expect(result.details.hasDmarc).toBe(true);
    });

    it('should fail if DKIM is missing', () => {
      const records: DnsRecord[] = [
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing DKIM record (required for email signing)');
    });

    it('should fail if SPF is missing', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing SPF record (required for sender verification)');
    });

    it('should fail if Return-Path is missing', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing Return-Path CNAME (send → send.resend.com). Required for bounce handling.');
    });

    it('should fail if DKIM has both CNAME and TXT', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: 'resend._domainkey', value: 'v=DKIM1; k=rsa; p=MIIB...', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Conflicting DKIM records: both CNAME and TXT present. Use CNAME only.');
    });

    it('should fail if multiple SPF records exist', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:other.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Multiple SPF records'))).toBe(true);
    });

    it('should warn but not fail if DMARC is missing', () => {
      const records: DnsRecord[] = [
        { type: 'CNAME', host: 'resend._domainkey', value: 'resend._domainkey.resend.com', ttl: 3600 },
        { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.resend.com ~all', ttl: 3600 },
        { type: 'CNAME', host: 'send', value: 'send.resend.com', ttl: 3600 }
      ];

      const result = validateCanonicalRecords(records);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('No DMARC record found. Recommended for email policy enforcement.');
    });
  });

  describe('prepareRecordsForEntri', () => {
    it('should sanitize and validate backend records', () => {
      const backendRecords = [
        { name: 'resend._domainkey.example.com', type: 'CNAME', value: 'resend._domainkey.resend.com' },
        { name: 'resend._domainkey.example.com', type: 'TXT', value: 'v=DKIM1; k=rsa; p=MIIB...' },
        { name: 'example.com', type: 'TXT', value: 'v=spf1 include:_spf.resend.com ~all' },
        { name: 'send.example.com', type: 'CNAME', value: 'send.resend.com' },
        { name: '_dmarc.example.com', type: 'TXT', value: 'v=DMARC1; p=quarantine' }
      ];

      const result = prepareRecordsForEntri(testDomain, backendRecords);

      // Should have dropped the DKIM TXT
      expect(result.records).toHaveLength(4);
      expect(result.records.find(r => r.type === 'TXT' && r.host.includes('domainkey'))).toBeUndefined();
      expect(result.validation.valid).toBe(true);
    });

    it('should fail validation if backend records are incomplete', () => {
      const backendRecords = [
        { name: 'example.com', type: 'TXT', value: 'v=spf1 include:_spf.resend.com ~all' }
      ];

      const result = prepareRecordsForEntri(testDomain, backendRecords);

      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });
});
