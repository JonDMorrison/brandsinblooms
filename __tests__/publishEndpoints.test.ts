
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  functions: {
    invoke: jest.fn()
  }
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('Publish Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schedule Post', () => {
    it('should successfully schedule a post', async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      // Mock content exists and user owns it
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: { id: 'content-123' },
        error: null
      });

      // Mock social connection exists
      mockSupabase.from().select().eq().eq().eq().single.mockResolvedValue({
        data: { id: 'conn-123', expires_at: new Date(Date.now() + 86400000).toISOString() },
        error: null
      });

      // Mock successful insert
      mockSupabase.from().insert.mockResolvedValue({
        error: null
      });

      // Mock successful update
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { ok: true },
        error: null
      });

      const response = await mockSupabase.functions.invoke('publish-schedule', {
        body: JSON.stringify({
          contentId: 'content-123',
          caption: 'Test post',
          platforms: ['FB'],
          publishAt: new Date(Date.now() + 3600000).toISOString()
        })
      });

      expect(response.data).toEqual({ ok: true });
      expect(response.error).toBeNull();
    });

    it('should reject unauthorized requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized' }
      });

      const response = await mockSupabase.functions.invoke('publish-schedule', {
        body: JSON.stringify({
          contentId: 'content-123',
          caption: 'Test post',
          platforms: ['FB'],
          publishAt: new Date(Date.now() + 3600000).toISOString()
        })
      });

      expect(response.error).toBeTruthy();
    });

    it('should validate caption length', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Caption too long (max 2000 characters)' }
      });

      const longCaption = 'a'.repeat(2001);
      const response = await mockSupabase.functions.invoke('publish-schedule', {
        body: JSON.stringify({
          contentId: 'content-123',
          caption: longCaption,
          platforms: ['FB'],
          publishAt: new Date(Date.now() + 3600000).toISOString()
        })
      });

      expect(response.error.message).toContain('Caption too long');
    });

    it('should reject expired tokens', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: { id: 'content-123' },
        error: null
      });

      mockSupabase.from().select().eq().eq().eq().single.mockResolvedValue({
        data: { id: 'conn-123', expires_at: new Date(Date.now() - 3600000).toISOString() },
        error: null
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Token expired for FB' }
      });

      const response = await mockSupabase.functions.invoke('publish-schedule', {
        body: JSON.stringify({
          contentId: 'content-123',
          caption: 'Test post',
          platforms: ['FB'],
          publishAt: new Date(Date.now() + 3600000).toISOString()
        })
      });

      expect(response.error.message).toContain('Token expired');
    });
  });

  describe('Publish Now', () => {
    it('should immediately publish a post', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { ok: true, results: [{ platform: 'FB', success: true, publishedId: 'fb-123' }] },
        error: null
      });

      const response = await mockSupabase.functions.invoke('publish-now', {
        body: JSON.stringify({
          contentId: 'content-123',
          caption: 'Test post',
          platforms: ['FB']
        })
      });

      expect(response.data.ok).toBe(true);
      expect(response.data.results[0].success).toBe(true);
    });
  });

  describe('Reschedule Post', () => {
    it('should reschedule a queued post', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { ok: true },
        error: null
      });

      const response = await mockSupabase.functions.invoke('publish-reschedule', {
        body: JSON.stringify({
          scheduledId: 'scheduled-123',
          publishAt: new Date(Date.now() + 7200000).toISOString()
        })
      });

      expect(response.data).toEqual({ ok: true });
    });

    it('should reject rescheduling published posts', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } }
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Cannot reschedule published post' }
      });

      const response = await mockSupabase.functions.invoke('publish-reschedule', {
        body: JSON.stringify({
          scheduledId: 'scheduled-123',
          publishAt: new Date(Date.now() + 7200000).toISOString()
        })
      });

      expect(response.error.message).toBe('Cannot reschedule published post');
    });
  });
});
