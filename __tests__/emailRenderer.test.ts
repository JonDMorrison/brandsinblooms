import { describe, it, expect } from 'vitest';
import { renderToString } from '@/features/newsletter/renderer/EmailRenderer';

describe('EmailRenderer', () => {
  it('renders minimal HTML string', () => {
    const html = renderToString([
      { id: '1', type: 'text', heading: 'Hello', body: '<p>World</p>' } as any,
    ]);
    expect(typeof html).toBe('string');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hello');
    expect(html).toContain('<p>World</p>');
  });
});
