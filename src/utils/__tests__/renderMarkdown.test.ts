
import { renderMarkdownToMagazineHtml, extractNewsletterThumbnail } from '../renderMarkdown';

describe('renderMarkdownToMagazineHtml', () => {
  it('should convert headers with proper styling', () => {
    const markdown = '# Main Title\n## Section Header\n### Sub Header';
    const result = renderMarkdownToMagazineHtml(markdown);
    
    expect(result).toContain('class="text-3xl font-bold text-gray-900 mb-6 leading-tight"');
    expect(result).toContain('class="text-2xl font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200"');
    expect(result).toContain('class="text-xl font-semibold text-slate-800 mt-6 mb-3"');
  });

  it('should handle floating images', () => {
    const markdown = '![Alt text](image.jpg)\nThis is some text after the image.';
    const result = renderMarkdownToMagazineHtml(markdown);
    
    expect(result).toContain('class="w-1/3 float-right ml-6 mb-4 clear-both"');
  });

  it('should convert bold and italic with custom styling', () => {
    const markdown = '**Bold text** and *italic text*';
    const result = renderMarkdownToMagazineHtml(markdown);
    
    expect(result).toContain('class="font-semibold text-slate-900"');
    expect(result).toContain('class="italic text-slate-700"');
  });

  it('should include reading time', () => {
    const markdown = 'Short content';
    const result = renderMarkdownToMagazineHtml(markdown);
    
    expect(result).toContain('Estimated read time:');
    expect(result).toContain('min');
  });
});

describe('extractNewsletterThumbnail', () => {
  it('should extract plain text and truncate', () => {
    const markdown = '# Title\n\n**Bold text** and some regular content that goes on and on';
    const result = extractNewsletterThumbnail(markdown, 20);
    
    expect(result).not.toContain('#');
    expect(result).not.toContain('**');
    expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    expect(result).toContain('...');
  });

  it('should return original text if shorter than limit', () => {
    const markdown = 'Short text';
    const result = extractNewsletterThumbnail(markdown, 100);
    
    expect(result).toBe('Short text');
    expect(result).not.toContain('...');
  });
});
