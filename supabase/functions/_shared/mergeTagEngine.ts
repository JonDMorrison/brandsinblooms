/**
 * Unified Merge Tag Engine for BloomSuite Edge Functions
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
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number') {
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
 */
export function renderMergeTags(template: string, data: MergeTagData): string {
  if (!template) return '';
  
  const now = new Date();
  
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
    let value = getNestedValue(enrichedData as Record<string, unknown>, fieldPath);
    
    if (value === null || value === undefined || value === '') {
      if (explicitDefault !== undefined) {
        return explicitDefault;
      }
      
      const globalFallback = GLOBAL_FALLBACKS[fieldPath];
      if (globalFallback !== undefined) {
        return globalFallback;
      }
      
      return '';
    }
    
    return formatValue(value);
  });
}

/**
 * Legacy tag conversion mappings
 */
const LEGACY_MAPPINGS: Record<string, string> = {
  'firstName': 'first_name',
  'lastName': 'last_name',
  'company_name': 'company.name',
  'companyName': 'company.name',
  'customer.name': 'first_name',
  'customer_name': 'first_name',
  'customerName': 'first_name',
  'customer.first_name': 'first_name',
  'customer.last_name': 'last_name',
  'unsubscribe_url': 'system.unsubscribe_url',
  'unsubscribeUrl': 'system.unsubscribe_url',
};

/**
 * Convert legacy tag key to modern format
 */
function convertTagKey(legacyKey: string): string {
  if (LEGACY_MAPPINGS[legacyKey]) {
    return LEGACY_MAPPINGS[legacyKey];
  }
  const snakeCase = legacyKey.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (LEGACY_MAPPINGS[snakeCase]) {
    return LEGACY_MAPPINGS[snakeCase];
  }
  return snakeCase;
}

/**
 * Convert legacy tags to modern syntax
 */
export function convertLegacyTags(template: string): string {
  if (!template) return '';
  
  let result = template;
  
  // Handle {single_curly} patterns
  result = result.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, key) => {
      const modernKey = convertTagKey(key);
      const fallback = GLOBAL_FALLBACKS[modernKey] || '';
      if (fallback) {
        return `{{ ${modernKey} | default: "${fallback}" }}`;
      }
      return `{{ ${modernKey} }}`;
    }
  );
  
  // Handle {{ tag }} without defaults - add defaults
  result = result.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g,
    (match, key) => {
      const modernKey = convertTagKey(key);
      const fallback = GLOBAL_FALLBACKS[modernKey] || '';
      if (fallback) {
        return `{{ ${modernKey} | default: "${fallback}" }}`;
      }
      return `{{ ${modernKey} }}`;
    }
  );
  
  return result;
}

/**
 * Create merge tag data from a customer record
 */
export function createMergeTagDataFromCustomer(
  customer: Record<string, unknown>,
  companyInfo?: Record<string, unknown>
): MergeTagData {
  return {
    first_name: customer.first_name as string | undefined,
    last_name: customer.last_name as string | undefined,
    email: customer.email as string | undefined,
    phone: customer.phone as string | undefined,
    lifetime_value: customer.lifetime_value as number | undefined,
    total_spent: customer.total_spent as number | undefined,
    first_purchase_date: customer.first_purchase_date as string | undefined,
    last_purchase_date: customer.last_purchase_date as string | undefined,
    custom: (customer.custom_fields as Record<string, unknown>) || {},
    company: {
      name: companyInfo?.company_name as string | undefined,
      address: companyInfo?.address as string | undefined,
      phone: companyInfo?.phone as string | undefined,
      email: companyInfo?.email as string | undefined,
      website: companyInfo?.website_url as string | undefined,
    },
  };
}
