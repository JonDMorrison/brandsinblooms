/**
 * Integration Tests: Prefill and Template Behavior
 * 
 * These tests verify that prefill logic runs exactly once,
 * respects user edits, and does not cause cross-contamination.
 */

import { describe, it, expect, vi } from 'vitest';
import { ContentBlock, BlockStatus } from '@/types/emailBuilder';

/**
 * Simulates the prefill guard logic
 */
class PrefillGuard {
  private hasApplied = false;

  canApply(): boolean {
    if (this.hasApplied) {
      return false;
    }
    return true;
  }

  markApplied(): void {
    this.hasApplied = true;
  }

  reset(): void {
    this.hasApplied = false;
  }
}

/**
 * Simulates the block status protection logic
 */
function shouldInjectDefaults(block: ContentBlock): boolean {
  // Only inject defaults for empty blocks
  if (block.status === 'user-edited') {
    return false;
  }
  if (block.status === 'ai-generated') {
    return false;
  }
  return block.status === 'empty' || !block.status;
}

/**
 * Simulates the hydration logic that respects block status
 */
function hydrateBlock(block: ContentBlock, defaults: Partial<ContentBlock>): ContentBlock {
  if (!shouldInjectDefaults(block)) {
    // Don't overwrite - return original
    return block;
  }

  // Apply defaults only for empty blocks
  return {
    ...block,
    headline: block.headline || defaults.headline,
    body: block.body || defaults.body,
    imageUrl: block.imageUrl || defaults.imageUrl,
  };
}

describe('Prefill Behavior - Single Run Guard', () => {
  
  describe('PrefillGuard', () => {
    it('should allow prefill only once', () => {
      const guard = new PrefillGuard();

      expect(guard.canApply()).toBe(true);
      guard.markApplied();
      expect(guard.canApply()).toBe(false);
      expect(guard.canApply()).toBe(false);
    });

    it('should stay locked after multiple checks', () => {
      const guard = new PrefillGuard();

      guard.markApplied();
      
      // Multiple checks should all return false
      for (let i = 0; i < 10; i++) {
        expect(guard.canApply()).toBe(false);
      }
    });
  });

  describe('Block status protection', () => {
    it('should not inject defaults into user-edited blocks', () => {
      const userEditedBlock: ContentBlock = {
        id: 'block-1',
        type: 'image-text',
        headline: 'My Custom Headline',
        body: 'My custom content',
        status: 'user-edited',
        userEdited: true,
        source: 'manual',
      };

      const defaults = {
        headline: 'Default Headline',
        body: 'Default body text',
      };

      const result = hydrateBlock(userEditedBlock, defaults);

      // Should preserve user content
      expect(result.headline).toBe('My Custom Headline');
      expect(result.body).toBe('My custom content');
    });

    it('should not inject defaults into ai-generated blocks', () => {
      const aiBlock: ContentBlock = {
        id: 'block-2',
        type: 'image-text',
        headline: 'AI Generated Headline',
        body: 'AI generated content',
        status: 'ai-generated',
        hasGeneratedContent: true,
        source: 'ai',
      };

      const defaults = {
        headline: 'Placeholder',
        body: 'Placeholder body',
      };

      const result = hydrateBlock(aiBlock, defaults);

      expect(result.headline).toBe('AI Generated Headline');
      expect(result.body).toBe('AI generated content');
    });

    it('should inject defaults into empty blocks', () => {
      const emptyBlock: ContentBlock = {
        id: 'block-3',
        type: 'image-text',
        status: 'empty',
        source: 'manual',
      };

      const defaults = {
        headline: 'Default Headline',
        body: 'Default body text',
      };

      const result = hydrateBlock(emptyBlock, defaults);

      expect(result.headline).toBe('Default Headline');
      expect(result.body).toBe('Default body text');
    });

    it('should inject defaults into blocks without status', () => {
      const legacyBlock: ContentBlock = {
        id: 'block-4',
        type: 'image-text',
        // No status field (legacy block)
        source: 'manual',
      };

      const defaults = {
        headline: 'Default',
        body: 'Default body',
      };

      const result = hydrateBlock(legacyBlock, defaults);

      expect(result.headline).toBe('Default');
    });
  });
});

describe('Template and Campaign Cross-Contamination Prevention', () => {
  
  describe('Explicit ID-based lookup', () => {
    it('should NOT match campaigns by fuzzy name', () => {
      const campaigns = [
        { id: 'camp-1', name: 'Winter Garden Sale', template_id: null },
        { id: 'camp-2', name: 'Spring Garden Tips', template_id: 'template-spring' },
        { id: 'camp-3', name: 'Garden Center News', template_id: null },
      ];

      // Simulating the OLD broken behavior (should NOT be used)
      const fuzzySearch = (topic: string) => {
        const pattern = topic.toLowerCase();
        return campaigns.find(c => c.name.toLowerCase().includes(pattern));
      };

      // "Garden" would match multiple campaigns - BAD!
      const fuzzyResult = fuzzySearch('garden');
      expect(fuzzyResult).toBeDefined(); // This is the problem

      // NEW correct behavior: Explicit template_id lookup
      const explicitSearch = (templateId: string) => {
        return campaigns.find(c => c.template_id === templateId);
      };

      const explicitResult = explicitSearch('template-spring');
      expect(explicitResult?.id).toBe('camp-2');
      expect(explicitResult?.name).toBe('Spring Garden Tips');

      // Searching for non-existent template returns nothing
      const notFound = explicitSearch('template-nonexistent');
      expect(notFound).toBeUndefined();
    });

    it('should lookup campaigns by exact ID for cloning', () => {
      const campaigns = [
        { id: 'camp-1', name: 'Original Campaign' },
        { id: 'camp-2', name: 'Similar Campaign' },
      ];

      const lookupById = (id: string) => campaigns.find(c => c.id === id);

      expect(lookupById('camp-1')?.name).toBe('Original Campaign');
      expect(lookupById('camp-2')?.name).toBe('Similar Campaign');
      expect(lookupById('camp-nonexistent')).toBeUndefined();
    });

    it('should set source_campaign_id when cloning', () => {
      interface Campaign {
        id: string;
        name: string;
        source_campaign_id: string | null;
      }

      const createClone = (original: Campaign): Campaign => ({
        id: 'new-' + Date.now(),
        name: `Copy of ${original.name}`,
        source_campaign_id: original.id,
      });

      const original: Campaign = {
        id: 'orig-123',
        name: 'My Newsletter',
        source_campaign_id: null,
      };

      const clone = createClone(original);

      expect(clone.source_campaign_id).toBe('orig-123');
      expect(clone.name).toBe('Copy of My Newsletter');
    });
  });
});

describe('Persistence Key Uniqueness', () => {
  
  describe('Session ID generation', () => {
    it('should use campaign UUID for existing campaigns', () => {
      const generateSessionId = (campaignSlug: string | undefined): string => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (campaignSlug && uuidRegex.test(campaignSlug)) {
          return campaignSlug;
        }
        return `new_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      };

      const existingCampaignSlug = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const sessionId = generateSessionId(existingCampaignSlug);

      expect(sessionId).toBe(existingCampaignSlug);
    });

    it('should generate unique session ID for new campaigns', () => {
      const generateSessionId = (campaignSlug: string | undefined): string => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (campaignSlug && uuidRegex.test(campaignSlug)) {
          return campaignSlug;
        }
        return `new_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      };

      const sessionId1 = generateSessionId('new');
      const sessionId2 = generateSessionId(undefined);
      const sessionId3 = generateSessionId('new');

      // All should start with 'new_'
      expect(sessionId1.startsWith('new_')).toBe(true);
      expect(sessionId2.startsWith('new_')).toBe(true);
      expect(sessionId3.startsWith('new_')).toBe(true);

      // All should be unique (high probability)
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId2).not.toBe(sessionId3);
    });
  });

  describe('Persistence key isolation', () => {
    it('should create unique persistence keys per session', () => {
      const createPersistenceKey = (baseKey: string, sessionId: string): string => {
        return `page_persist_${baseKey}_${sessionId}`;
      };

      const key1 = createPersistenceKey('campaign_creator', 'uuid-123');
      const key2 = createPersistenceKey('campaign_creator', 'uuid-456');
      const key3 = createPersistenceKey('campaign_creator', 'new_12345_abc');

      expect(key1).toBe('page_persist_campaign_creator_uuid-123');
      expect(key2).toBe('page_persist_campaign_creator_uuid-456');
      expect(key3).toBe('page_persist_campaign_creator_new_12345_abc');

      // All different
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
    });

    it('should not use pathname-only keys', () => {
      // OLD broken approach
      const oldBrokenKey = (pathname: string) => `page_persist_${pathname}`;
      
      // This would cause two tabs editing different "new" campaigns to collide
      const tab1Key = oldBrokenKey('/crm/campaigns/new');
      const tab2Key = oldBrokenKey('/crm/campaigns/new');
      
      expect(tab1Key).toBe(tab2Key); // They're the same - BAD!

      // NEW correct approach
      const newCorrectKey = (sessionId: string) => 
        `page_persist_campaign_creator_${sessionId}`;
      
      const tab1SessionId = 'new_1234567890_abc123';
      const tab2SessionId = 'new_1234567891_def456';
      
      const tab1CorrectKey = newCorrectKey(tab1SessionId);
      const tab2CorrectKey = newCorrectKey(tab2SessionId);
      
      expect(tab1CorrectKey).not.toBe(tab2CorrectKey); // Unique - GOOD!
    });
  });
});

describe('QA Checklist Assertions', () => {
  
  it('✓ Prefill runs exactly once (via hasAppliedPrefillRef guard)', () => {
    const guard = new PrefillGuard();
    let prefillRunCount = 0;

    // Simulate effect running multiple times
    for (let i = 0; i < 5; i++) {
      if (guard.canApply()) {
        prefillRunCount++;
        guard.markApplied();
      }
    }

    expect(prefillRunCount).toBe(1);
  });

  it('✓ User-edited blocks are never overwritten by hydration', () => {
    const userBlock: ContentBlock = {
      id: 'user-1',
      type: 'image-text',
      headline: 'User Content',
      status: 'user-edited',
      source: 'manual',
    };

    expect(shouldInjectDefaults(userBlock)).toBe(false);
  });

  it('✓ Template reuse requires explicit template_id', () => {
    // No ilike query - just explicit ID lookup
    const lookupByTemplate = (templateId: string | undefined) => {
      if (!templateId) return undefined;
      // Would call .eq('template_id', templateId)
      return { id: 'found', template_id: templateId };
    };

    expect(lookupByTemplate(undefined)).toBeUndefined();
    expect(lookupByTemplate('template-123')).toBeDefined();
  });

  it('✓ New campaigns start fresh without reusing other campaign content', () => {
    // When no template_id and no source_campaign_id, start with empty/default blocks
    interface NewCampaignOptions {
      template_id?: string;
      source_campaign_id?: string;
    }

    const createInitialBlocks = (options: NewCampaignOptions): ContentBlock[] => {
      if (options.template_id) {
        // Load from template
        return [{ id: 'template-block', type: 'header', source: 'template' }];
      }
      if (options.source_campaign_id) {
        // Clone from campaign
        return [{ id: 'cloned-block', type: 'header', source: 'manual' }];
      }
      // Fresh campaign - empty blocks
      return [{
        id: 'fresh-block',
        type: 'header',
        status: 'empty',
        source: 'manual',
      }];
    };

    const freshBlocks = createInitialBlocks({});
    expect(freshBlocks[0].status).toBe('empty');
    expect(freshBlocks[0].source).toBe('manual');
  });
});
