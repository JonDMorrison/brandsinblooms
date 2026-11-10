import { describe, expect, it } from 'vitest';
import { resolveStudioDraftId } from './studioEntry';
describe('draft creation', () => { it('does not need a subject before editor entry', async () => { expect(await resolveStudioDraftId(null, async () => 'draft-id')).toBe('draft-id'); }); });
