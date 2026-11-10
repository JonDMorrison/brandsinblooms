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
});
