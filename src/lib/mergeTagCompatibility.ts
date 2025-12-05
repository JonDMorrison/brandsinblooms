/**
 * Merge Tag Compatibility Layer for BloomSuite
 * 
 * Converts legacy merge tag syntaxes to the unified format.
 * This ensures backward compatibility with existing campaigns and templates.
 */

import { GLOBAL_FALLBACKS } from './mergeTagEngine';

/**
 * Legacy tag patterns and their modern equivalents
 */
const LEGACY_MAPPINGS: Record<string, string> = {
  // Single curly brace patterns (from email templates)
  'firstName': 'first_name',
  'first_name': 'first_name',
  'lastName': 'last_name',
  'last_name': 'last_name',
  'email': 'email',
  'phone': 'phone',
  
  // Company patterns
  'company_name': 'company.name',
  'companyName': 'company.name',
  'company.name': 'company.name',
  'company_address': 'company.address',
  'companyAddress': 'company.address',
  'company.address': 'company.address',
  'company_phone': 'company.phone',
  'companyPhone': 'company.phone',
  'company.phone': 'company.phone',
  'company_email': 'company.email',
  'companyEmail': 'company.email',
  'company.email': 'company.email',
  
  // System patterns
  'unsubscribe_url': 'system.unsubscribe_url',
  'unsubscribeUrl': 'system.unsubscribe_url',
  'unsubscribe.url': 'system.unsubscribe_url',
  'manage_preferences_url': 'system.preferences_url',
  'managePreferencesUrl': 'system.preferences_url',
  'preferences.url': 'system.preferences_url',
  
  // Customer patterns from SMS/automation
  'customer.name': 'first_name',
  'customer_name': 'first_name',
  'customerName': 'first_name',
  'customer.email': 'email',
  'customer_email': 'email',
  'customerEmail': 'email',
  'customer.first_name': 'first_name',
  'customer.last_name': 'last_name',
  
  // Value patterns
  'lifetime_value': 'lifetime_value',
  'lifetimeValue': 'lifetime_value',
  'total_spent': 'total_spent',
  'totalSpent': 'total_spent',
};

/**
 * Regex patterns for different legacy syntaxes
 */
const LEGACY_PATTERNS = [
  // {single_curly} - used in email templates
  /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
  
  // {camelCase} - used in some places
  /\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
  
  // {{no_spaces}} - double curly without spaces
  /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g,
  
  // {% liquid_style %} - liquid template syntax
  /\{%\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g,
];

/**
 * Convert a legacy tag key to the modern format
 */
function convertTagKey(legacyKey: string): string {
  // Check direct mapping
  if (LEGACY_MAPPINGS[legacyKey]) {
    return LEGACY_MAPPINGS[legacyKey];
  }
  
  // Convert camelCase to snake_case
  const snakeCase = legacyKey.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (LEGACY_MAPPINGS[snakeCase]) {
    return LEGACY_MAPPINGS[snakeCase];
  }
  
  // Return as-is if no mapping found (might be a custom field)
  return snakeCase;
}

/**
 * Get the default fallback for a tag key
 */
function getDefaultFallback(key: string): string {
  return GLOBAL_FALLBACKS[key] || '';
}

/**
 * Convert a legacy tag to the modern syntax with fallback
 */
function convertToModernSyntax(tagKey: string): string {
  const modernKey = convertTagKey(tagKey);
  const fallback = getDefaultFallback(modernKey);
  
  if (fallback) {
    return `{{ ${modernKey} | default: "${fallback}" }}`;
  }
  
  return `{{ ${modernKey} }}`;
}

/**
 * Convert all legacy merge tags in a template to modern syntax
 * 
 * @param template - The template string with potential legacy tags
 * @returns The template with all tags converted to modern syntax
 */
export function convertLegacyTags(template: string): string {
  if (!template) return '';
  
  let result = template;
  
  // First, handle already-modern tags that just need fallbacks added
  // Match {{ tag }} without a default
  result = result.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g,
    (match, key) => {
      // Check if this is already a modern tag with proper format
      const modernKey = convertTagKey(key);
      const fallback = getDefaultFallback(modernKey);
      
      if (fallback) {
        return `{{ ${modernKey} | default: "${fallback}" }}`;
      }
      return `{{ ${modernKey} }}`;
    }
  );
  
  // Handle {single_curly} patterns
  result = result.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, key) => convertToModernSyntax(key)
  );
  
  // Handle {% liquid_style %} patterns
  result = result.replace(
    /\{%\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g,
    (match, key) => convertToModernSyntax(key)
  );
  
  return result;
}

/**
 * Check if a template contains legacy merge tag syntax
 */
export function containsLegacyTags(template: string): boolean {
  if (!template) return false;
  
  // Check for single curly braces (but not double)
  if (/(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/.test(template)) {
    return true;
  }
  
  // Check for liquid style
  if (/\{%\s*[a-zA-Z_][a-zA-Z0-9_]*\s*%\}/.test(template)) {
    return true;
  }
  
  // Check for double curly without spaces or defaults
  if (/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/.test(template)) {
    // This might be modern syntax, but without proper spacing
    return true;
  }
  
  return false;
}

/**
 * Normalize a template by converting legacy tags and ensuring consistent formatting
 */
export function normalizeTemplate(template: string): string {
  if (!template) return '';
  
  // Convert legacy tags
  let normalized = convertLegacyTags(template);
  
  // Normalize spacing in modern tags
  normalized = normalized.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g,
    (match, key, defaultVal) => {
      if (defaultVal !== undefined) {
        return `{{ ${key} | default: "${defaultVal}" }}`;
      }
      const fallback = getDefaultFallback(key);
      if (fallback) {
        return `{{ ${key} | default: "${fallback}" }}`;
      }
      return `{{ ${key} }}`;
    }
  );
  
  return normalized;
}

/**
 * Get a list of all legacy tags found in a template
 */
export function findLegacyTags(template: string): string[] {
  if (!template) return [];
  
  const legacyTags: string[] = [];
  
  // Find single curly brace tags
  const singleCurlyMatches = template.matchAll(/(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})/g);
  for (const match of singleCurlyMatches) {
    legacyTags.push(`{${match[1]}}`);
  }
  
  // Find liquid style tags
  const liquidMatches = template.matchAll(/\{%\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g);
  for (const match of liquidMatches) {
    legacyTags.push(`{% ${match[1]} %}`);
  }
  
  return [...new Set(legacyTags)];
}
