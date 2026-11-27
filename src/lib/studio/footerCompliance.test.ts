import { describe, expect, it } from 'vitest';
import { ensureFooterBlockCompliance } from './footerCompliance';
import { buildStudioDesignSystem } from './designSystem';
import type { CompanyInfo } from '@/types/company';
import type { StudioBlock } from '@/types/studioBlocks';

const designSystem = buildStudioDesignSystem({
  name: 'Store', address: 'Default address', streetAddress: 'Default address',
  city: '', stateProvince: '', postalCode: '', country: '', phone: '', email: '',
  websiteUrl: 'https://default.example', footerLegalText: 'Default legal text',
} as CompanyInfo);

describe('footer compliance', () => {
  it('preserves edited footer values when preparing a draft for saving', () => {
    const footer = { id: 'footer', type: 'footer', label: 'Footer', order: 0,
      address: 'Default address\nClosing 11/1\nOpening 3/12',
      websiteUrl: 'https://store.example', businessName: 'My Store',
      complianceText: 'Custom text', showWebsiteLink: false } as StudioBlock;
    const saved = ensureFooterBlockCompliance([footer], { designSystem })[0];
    expect(saved).toMatchObject({ address: footer.address, websiteUrl: footer.websiteUrl,
      businessName: footer.businessName, complianceText: footer.complianceText, showWebsiteLink: false });
    expect(ensureFooterBlockCompliance([saved], { designSystem })[0]).toMatchObject(saved);
  });
  it('fills missing footer fields from the profile', () => {
    const footer = { id: 'footer', type: 'footer', label: 'Footer', order: 0 } as StudioBlock;
    expect(ensureFooterBlockCompliance([footer], { designSystem })[0]).toMatchObject({
      businessName: 'Store', websiteUrl: 'https://default.example', showWebsiteLink: true,
    });
  });
  it('starts a new draft footer with the tenant business name, never a placeholder', () => {
    const tenantDesign = buildStudioDesignSystem({ name: 'Northfield Garden Center' });
    const [footer] = ensureFooterBlockCompliance([], { designSystem: tenantDesign });
    expect(footer.businessName).toBe('Northfield Garden Center');
    expect(footer.address).toBe('');
    for (const placeholder of ['Your Company', 'Your Business']) {
      const [blank] = ensureFooterBlockCompliance([], {
        designSystem: buildStudioDesignSystem({ name: placeholder, address: '123 Business St, Suite 100, City, State 12345' }),
      });
      expect(blank.businessName).toBe('');
      expect(blank.address).toBe('');
      expect(JSON.stringify(blank)).not.toMatch(/Your Company|Your Business|123 Business St|123 Main St/);
    }
  });
  it('replaces placeholders saved in older drafts with the tenant details', () => {
    const footer = { id: 'footer', type: 'footer', label: 'Footer', order: 0,
      businessName: 'Your Company', address: '123 Business St, Suite 100, City, State 12345',
      copyright: '© 2026 Your Company', copyrightText: '© 2026 Your Company' } as StudioBlock;
    const [repaired] = ensureFooterBlockCompliance([footer], { designSystem });
    expect(repaired).toMatchObject({ businessName: 'Store', address: 'Default address' });
    expect(repaired.copyright).toBe(`© ${new Date().getFullYear()} Store`);
  });
});

import { generateEmailHtml, MISSING_ADDRESS_CHIP_ATTRIBUTE } from './emailHtmlGenerator';
import { resolveCampaignPostalAddress } from '../../../supabase/functions/_shared/campaignPostalAddress';

describe('missing postal address', () => {
  const noAddress = buildStudioDesignSystem({ name: 'Northfield Garden Center' });
  const footer = { id: 'footer', type: 'footer', label: 'Footer', order: 0, visible: true,
    businessName: 'Your Company', address: '123 Business St, Suite 100, City, State 12345' } as StudioBlock;
  const render = (showMissingAddressPrompt: boolean) => generateEmailHtml({
    blocks: [footer], subject: 'Hi', previewText: '', footer, designSystem: noAddress, showMissingAddressPrompt,
  });

  it('never renders placeholder business details in the sent email', () => {
    const html = render(false);
    expect(html).not.toMatch(/123 Business St|123 Main St|Your Company|Your Business/);
    expect(html).not.toContain(MISSING_ADDRESS_CHIP_ATTRIBUTE);
    expect(html).toContain('Northfield Garden Center');
  });
  it('shows an "Add your address" chip in editor previews instead of fake text', () => {
    const html = render(true);
    expect(html).toContain(`${MISSING_ADDRESS_CHIP_ATTRIBUTE}="true"`);
    expect(html).toContain('Add your address');
    expect(html).not.toMatch(/123 Business St|123 Main St/);
  });
  it('the send worker finds no postal address, so it holds the send', () => {
    expect(resolveCampaignPostalAddress([footer], { company_name: 'Northfield Garden Center' })).toBe('');
    expect(resolveCampaignPostalAddress([footer], null)).toBe('');
    expect(resolveCampaignPostalAddress([footer], {
      company_name: 'Northfield Garden Center', street_address: '1 Elm St', city: 'Portland',
    })).toContain('1 Elm St');
    expect(resolveCampaignPostalAddress([{ ...footer, address: '9 Oak Ave\nSalem' }], null)).toBe('9 Oak Ave\nSalem');
  });
});
