/**
 * Merge Tag Sanitizer
 * 
 * Ensures merge tags are not escaped by HTML encoding.
 * Rich text editors often escape {{ }} to HTML entities.
 */

/**
 * Normalize escaped merge tags back to proper {{ }} syntax
 * 
 * Use this:
 * - Before saving editor content to block state
 * - Before sending to server for rendering
 */
export function normalizeMergeTags(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // HTML entity escapes
  result = result
    .replace(/&#123;&#123;/g, '{{')
    .replace(/&#125;&#125;/g, '}}')
    .replace(/&#x7B;&#x7B;/g, '{{')
    .replace(/&#x7D;&#x7D;/g, '}}');
  
  // Named HTML entities
  result = result
    .replace(/&lbrace;&lbrace;/g, '{{')
    .replace(/&rbrace;&rbrace;/g, '}}');
  
  // URL-encoded braces
  result = result
    .replace(/%7B%7B/g, '{{')
    .replace(/%7D%7D/g, '}}');
  
  // Double-encoded entities
  result = result
    .replace(/&amp;#123;&amp;#123;/g, '{{')
    .replace(/&amp;#125;&amp;#125;/g, '}}');
  
  return result;
}

/**
 * Check if content contains escaped merge tags that need normalization
 */
export function hasEscapedMergeTags(text: string): boolean {
  if (!text) return false;
  
  const escapedPatterns = [
    /&#123;&#123;/,
    /&#125;&#125;/,
    /&#x7B;&#x7B;/,
    /&#x7D;&#x7D;/,
    /&lbrace;&lbrace;/,
    /&rbrace;&rbrace;/,
    /%7B%7B/,
    /%7D%7D/,
  ];
  
  return escapedPatterns.some(pattern => pattern.test(text));
}

/**
 * Validate that merge tags are properly formatted
 */
export function validateMergeTags(text: string): { valid: boolean; issues: string[] } {
  if (!text) return { valid: true, issues: [] };
  
  const issues: string[] = [];
  
  // Check for escaped tags
  if (hasEscapedMergeTags(text)) {
    issues.push('Contains HTML-escaped merge tags that may not render correctly');
  }
  
  // Check for malformed tags (missing closing braces)
  const openTags = (text.match(/\{\{/g) || []).length;
  const closeTags = (text.match(/\}\}/g) || []).length;
  
  if (openTags !== closeTags) {
    issues.push(`Mismatched braces: ${openTags} opening vs ${closeTags} closing`);
  }
  
  // Check for nested tags (not supported)
  if (/\{\{[^}]*\{\{/.test(text)) {
    issues.push('Nested merge tags are not supported');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

export default normalizeMergeTags;
