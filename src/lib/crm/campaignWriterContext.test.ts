import { describe, expect, it } from 'vitest';
import { resolveStudioDraftId } from './studioEntry';
describe('draft creation', () => { it('does not need a subject before editor entry', async () => { expect(await resolveStudioDraftId(null, async () => 'draft-id')).toBe('draft-id'); }); });

import { deriveCampaignDisplayName, isUnsetCampaignName } from './campaignDisplayName';

describe('campaign display name (#8)', () => {
  it('treats empty and legacy placeholder names as unset', () => {
    expect(isUnsetCampaignName('')).toBe(true);
    expect(isUnsetCampaignName('  Untitled Campaign ')).toBe(true);
    expect(isUnsetCampaignName('Campaign 3fa85f64')).toBe(true);
    expect(isUnsetCampaignName('Spring sale')).toBe(false);
  });
  it('uses a real name as-is', () => {
    expect(deriveCampaignDisplayName({ name: 'Spring sale', subjectLine: 'Ignored' })).toBe('Spring sale');
  });
  it('falls back to the subject line, then the first headline, then Draft, <date>', () => {
    expect(deriveCampaignDisplayName({ name: 'Untitled Campaign', subjectLine: '<b>20% off</b> perennials' })).toBe('20% off perennials');
    expect(deriveCampaignDisplayName({
      name: '', subjectLine: '',
      blocks: [{ type: 'newsletter-header', headline: '', visible: true }, { type: 'email-safe-hero', headline: 'Fresh evergreens' }, { type: 'footer', headline: 'x' }],
    })).toBe('Fresh evergreens');
    expect(deriveCampaignDisplayName({ name: '', subjectLine: '', blocks: [], date: '2026-11-23T12:00:00Z' })).toMatch(/^Draft, Nov 2[23], 2026$/);
  });
});
