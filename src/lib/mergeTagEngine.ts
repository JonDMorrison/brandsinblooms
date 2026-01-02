/**
 * Unified Merge Tag Engine for BloomSuite
 * 
 * Handles parsing and rendering of merge tags with fallback support.
 * Syntax: {{ field_name }} or {{ field_name | default: "fallback" }}
 * Nested fields: {{ custom.date_of_birth }}
 */

export interface MergeTagData {
  // Core contact fields
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  
  // CRM fields
  lifetime_value?: number | null;
  total_spent?: number | null;
  first_purchase_date?: string | null;
  last_purchase_date?: string | null;
  
  // Custom fields (JSONB)
  custom?: Record<string, unknown>;
  
  // Company fields
  company?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  
  // System fields
  system?: {
    unsubscribe_url?: string | null;
    preferences_url?: string | null;
    current_year?: string | null;
    current_date?: string | null;
    date_plus_3?: string | null;
    date_plus_7?: string | null;
    date_plus_14?: string | null;
    date_plus_30?: string | null;
  };
  
  // Allow additional fields
  [key: string]: unknown;
}

/**
 * Global fallback registry for merge tags
 * These are used when no explicit default is provided
 */
export const GLOBAL_FALLBACKS: Record<string, string> = {
  // Contact fields
  first_name: 'Friend',
  last_name: 'Customer',
  email: '',
  phone: '',
  
  // CRM fields
  lifetime_value: '0',
  total_spent: '0',
  first_purchase_date: '',
  last_purchase_date: '',
  
  // Company fields
  'company.name': 'Our Team',
  'company.address': '',
  'company.phone': '',
  'company.email': '',
  'company.website': '',
  
  // System fields
  'system.unsubscribe_url': '#',
  'system.preferences_url': '#',
  'system.current_year': new Date().getFullYear().toString(),
  'system.current_date': new Date().toLocaleDateString(),
};

/**
 * Regex to match merge tags
 * Matches: {{ field }} or {{ field | default: "value" }} or {{ field | default: 'value' }}
 */
const MERGE_TAG_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Format a value for display
 * Handles numbers, dates, and prevents undefined/null/[object Object]
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number') {
    // Format currency values nicely
    if (Number.isFinite(value)) {
      return value.toLocaleString();
    }
    return '0';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  if (typeof value === 'object') {
    // Prevent [object Object]
    return '';
  }
  
  return String(value);
}

/**
 * Add days to a date and return the result
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Main merge tag rendering function
 * 
 * @param template - The template string containing merge tags
 * @param data - The data object to resolve tags from
 * @returns The rendered string with all tags replaced
 */
export function renderMergeTags(template: string, data: MergeTagData): string {
  if (!template) return '';
  
  const now = new Date();
  
  // Add system fields if not present
  const enrichedData: MergeTagData = {
    ...data,
    system: {
      current_year: now.getFullYear().toString(),
      current_date: now.toLocaleDateString(),
      date_plus_3: addDays(now, 3).toLocaleDateString(),
      date_plus_7: addDays(now, 7).toLocaleDateString(),
      date_plus_14: addDays(now, 14).toLocaleDateString(),
      date_plus_30: addDays(now, 30).toLocaleDateString(),
      ...data.system,
    },
  };
  
  return template.replace(MERGE_TAG_REGEX, (match, fieldPath: string, explicitDefault?: string) => {
    // Try to get the value from the data
    let value = getNestedValue(enrichedData as Record<string, unknown>, fieldPath);
    
    // If value is empty/null/undefined, use fallbacks
    if (value === null || value === undefined || value === '') {
      // First try explicit default from tag
      if (explicitDefault !== undefined) {
        return explicitDefault;
      }
      
      // Then try global fallback
      const globalFallback = GLOBAL_FALLBACKS[fieldPath];
      if (globalFallback !== undefined) {
        return globalFallback;
      }
      
      // Final fallback: empty string (never show undefined)
      return '';
    }
    
    return formatValue(value);
  });
}

/**
 * Check if a template contains merge tags
 */
export function containsMergeTags(template: string): boolean {
  if (!template) return false;
  MERGE_TAG_REGEX.lastIndex = 0; // Reset regex state
  return MERGE_TAG_REGEX.test(template);
}

/**
 * Extract all merge tags from a template
 */
export function extractMergeTags(template: string): string[] {
  if (!template) return [];
  const tags: string[] = [];
  let match;
  
  const regex = new RegExp(MERGE_TAG_REGEX.source, 'g');
  while ((match = regex.exec(template)) !== null) {
    tags.push(match[1]);
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Validate that all merge tags in a template are valid
 */
export function validateMergeTags(template: string, availableTags: string[]): { valid: boolean; invalidTags: string[] } {
  const usedTags = extractMergeTags(template);
  const invalidTags = usedTags.filter(tag => !availableTags.includes(tag));
  
  return {
    valid: invalidTags.length === 0,
    invalidTags,
  };
}

/**
 * Create a preview data object with sample values
 */
export function createPreviewData(companyInfo?: Partial<MergeTagData['company']>): MergeTagData {
  return {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah@example.com',
    phone: '(555) 123-4567',
    lifetime_value: 450.00,
    total_spent: 450.00,
    first_purchase_date: '2024-03-15',
    last_purchase_date: '2024-11-20',
    custom: {
      date_of_birth: '1985-06-15',
      favorite_plant: 'Roses',
      membership_level: 'Gold',
    },
    company: {
      name: companyInfo?.name || 'Garden Center',
      address: companyInfo?.address || '123 Garden Way, Plantville, CA 90210',
      phone: companyInfo?.phone || '(555) 987-6543',
      email: companyInfo?.email || 'hello@gardencenter.com',
      website: companyInfo?.website || 'www.gardencenter.com',
      ...companyInfo,
    },
    system: {
      unsubscribe_url: '[Unsubscribe Link]',
      preferences_url: '[Manage Preferences]',
      current_year: new Date().getFullYear().toString(),
      current_date: new Date().toLocaleDateString(),
      date_plus_3: addDays(new Date(), 3).toLocaleDateString(),
      date_plus_7: addDays(new Date(), 7).toLocaleDateString(),
      date_plus_14: addDays(new Date(), 14).toLocaleDateString(),
      date_plus_30: addDays(new Date(), 30).toLocaleDateString(),
    },
  };
}
