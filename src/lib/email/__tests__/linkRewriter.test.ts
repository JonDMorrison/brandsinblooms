import { describe, it, expect } from 'vitest';
import {
  hasPII,
  shouldSkipLink,
  isTrackableUrl,
  extractLinks,
  decodeHtmlEntities,
  appendUtmParams,
  isValidUUID,
} from '../linkRewriter';

describe('linkRewriter', () => {
  describe('hasPII', () => {
    it('detects email parameter', () => {
      expect(hasPII('https://example.com?email=test@example.com')).toBe(true);
      expect(hasPII('https://example.com?e=test@example.com')).toBe(true);
      expect(hasPII('https://example.com?u=test@example.com')).toBe(true);
    });

    it('detects subscriber/msisdn parameters', () => {
      expect(hasPII('https://example.com?subscriber=123')).toBe(true);
      expect(hasPII('https://example.com?msisdn=1234567890')).toBe(true);
      expect(hasPII('https://example.com?phone=1234567890')).toBe(true);
    });

    it('detects merge tags', () => {
      expect(hasPII('https://example.com?name={{email}}')).toBe(true);
      expect(hasPII('https://example.com?name={{first_name}}')).toBe(true);
      expect(hasPII('https://example.com?id={recipient.email}')).toBe(true);
      expect(hasPII('https://example.com?id={recipient.phone}')).toBe(true);
    });

    it('returns false for clean URLs', () => {
      expect(hasPII('https://example.com')).toBe(false);
      expect(hasPII('https://example.com?utm_source=email')).toBe(false);
      expect(hasPII('https://example.com/product/123')).toBe(false);
    });
  });

  describe('shouldSkipLink', () => {
    it('skips mailto links', () => {
      expect(shouldSkipLink('mailto:test@example.com')).toBe(true);
    });

    it('skips tel links', () => {
      expect(shouldSkipLink('tel:+1234567890')).toBe(true);
    });

    it('skips sms links', () => {
      expect(shouldSkipLink('sms:+1234567890')).toBe(true);
    });

    it('skips data URIs', () => {
      expect(shouldSkipLink('data:image/png;base64,abc123')).toBe(true);
    });

    it('skips javascript links', () => {
      expect(shouldSkipLink('javascript:void(0)')).toBe(true);
    });

    it('skips fragment-only links', () => {
      expect(shouldSkipLink('#')).toBe(true);
      expect(shouldSkipLink('#section')).toBe(true);
    });

    it('skips unsubscribe links', () => {
      expect(shouldSkipLink('https://example.com/unsubscribe')).toBe(true);
      expect(shouldSkipLink('https://example.com/handle-unsubscribe')).toBe(true);
      expect(shouldSkipLink('https://example.com/UNSUBSCRIBE')).toBe(true);
    });

    it('skips manage preferences links', () => {
      expect(shouldSkipLink('https://example.com/manage-preferences')).toBe(true);
      expect(shouldSkipLink('https://example.com/manage_prefs')).toBe(true);
      expect(shouldSkipLink('https://example.com/email-preferences')).toBe(true);
      expect(shouldSkipLink('https://example.com/opt-out')).toBe(true);
    });

    it('does not skip regular HTTP links', () => {
      expect(shouldSkipLink('https://example.com')).toBe(false);
      expect(shouldSkipLink('https://example.com/product')).toBe(false);
    });
  });

  describe('isTrackableUrl', () => {
    it('accepts http and https URLs', () => {
      expect(isTrackableUrl('https://example.com')).toBe(true);
      expect(isTrackableUrl('http://example.com')).toBe(true);
    });

    it('rejects non-HTTP protocols', () => {
      expect(isTrackableUrl('mailto:test@example.com')).toBe(false);
      expect(isTrackableUrl('tel:123')).toBe(false);
      expect(isTrackableUrl('ftp://example.com')).toBe(false);
    });

    it('rejects unsubscribe links', () => {
      expect(isTrackableUrl('https://example.com/unsubscribe')).toBe(false);
    });

    it('rejects fragment-only links', () => {
      expect(isTrackableUrl('#anchor')).toBe(false);
    });
  });

  describe('decodeHtmlEntities', () => {
    it('decodes &amp;', () => {
      expect(decodeHtmlEntities('https://example.com?a=1&amp;b=2')).toBe('https://example.com?a=1&b=2');
    });

    it('decodes multiple entities', () => {
      expect(decodeHtmlEntities('a &lt; b &gt; c')).toBe('a < b > c');
    });

    it('leaves clean strings unchanged', () => {
      expect(decodeHtmlEntities('https://example.com')).toBe('https://example.com');
    });
  });

  describe('extractLinks', () => {
    it('extracts HTTP links from HTML', () => {
      const html = '<a href="https://example.com">Link</a>';
      const links = extractLinks(html);
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe('https://example.com');
    });

    it('skips mailto links', () => {
      const html = '<a href="mailto:test@example.com">Email</a>';
      const links = extractLinks(html);
      expect(links).toHaveLength(0);
    });

    it('skips tel links', () => {
      const html = '<a href="tel:+1234567890">Call</a>';
      const links = extractLinks(html);
      expect(links).toHaveLength(0);
    });

    it('skips unsubscribe links', () => {
      const html = '<a href="https://example.com/unsubscribe">Unsubscribe</a>';
      const links = extractLinks(html);
      expect(links).toHaveLength(0);
    });

    it('extracts multiple links', () => {
      const html = `
        <a href="https://example.com/page1">Page 1</a>
        <a href="https://example.com/page2">Page 2</a>
        <a href="mailto:test@example.com">Email</a>
      `;
      const links = extractLinks(html);
      expect(links).toHaveLength(2);
    });

    it('decodes HTML entities in links', () => {
      const html = '<a href="https://example.com?a=1&amp;b=2">Link</a>';
      const links = extractLinks(html);
      expect(links[0].href).toBe('https://example.com?a=1&b=2');
    });
  });

  describe('appendUtmParams', () => {
    it('appends UTM params to URL without any', () => {
      const result = appendUtmParams('https://example.com', 'campaign123');
      expect(result).toContain('utm_source=email');
      expect(result).toContain('utm_campaign=campaign123');
      expect(result).toContain('utm_medium=email');
    });

    it('preserves existing UTM params', () => {
      const result = appendUtmParams('https://example.com?utm_source=newsletter', 'campaign123');
      expect(result).toContain('utm_source=newsletter');
      expect(result).not.toContain('utm_source=email');
    });

    it('handles invalid URLs gracefully', () => {
      const result = appendUtmParams('not-a-url', 'campaign123');
      expect(result).toBe('not-a-url');
    });
  });

  describe('isValidUUID', () => {
    it('validates correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    });
  });
});
