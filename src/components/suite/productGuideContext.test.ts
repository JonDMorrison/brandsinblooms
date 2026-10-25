import { describe, expect, it } from 'vitest';
import { productGuideContext } from './productGuideContext';

describe('marketing demo context', () => {
  it('carries valid CRM topics and comparison into an editable message', () => {
    const result = productGuideContext(new URLSearchParams('product=crm&topics=customer-profiles,sms-consent-handling&comparison=mailchimp'));
    expect(result?.message).toContain('Customer profiles');
    expect(result?.message).toContain('SMS consent handling');
    expect(result?.message).toContain('Mailchimp');
  });
  it('does not interpret arbitrary URL input as a feature or product', () => {
    expect(productGuideContext(new URLSearchParams('product=__proto__'))).toBeNull();
    const result = productGuideContext(new URLSearchParams('product=crm&guide=constructor&topics=%3Cscript%3E,customer-profiles&comparison=__proto__'));
    expect(result?.message).not.toContain('<script>');
    expect(result?.message).not.toContain('constructor');
    expect(result?.message).not.toContain('__proto__');
    expect(result?.message).toContain('Customer profiles');
  });
  it('keeps topics product-specific and deduplicates them', () => {
    const result = productGuideContext(new URLSearchParams('product=website&guide=hero-images&topics=hero-images,customer-profiles'));
    expect(result?.message.match(/Hero images/g)).toHaveLength(1);
    expect(result?.message).not.toContain('Customer profiles');
  });
  it('limits the handoff to six topics and fits the existing contact form', () => {
    const topics = 'customer-profiles,customer-purchase-history,customer-activity-timeline,customer-csv-imports,customer-data-cleanup,customer-list-exports,customer-segments';
    const result = productGuideContext(new URLSearchParams({ product: 'crm', topics }));
    expect(result?.message.match(/•/g)).toHaveLength(6);
    expect(result?.message.length).toBeLessThan(1000);
    expect(result?.message).not.toContain('Customer segments');
  });
  it('preserves POS and suite contact entry behaviour by returning no context', () => {
    expect(productGuideContext(new URLSearchParams('product=pos&feature=checkout'))).toBeNull();
    expect(productGuideContext(new URLSearchParams('product=suite'))).toBeNull();
  });
});
