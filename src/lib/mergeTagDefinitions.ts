/**
 * Merge Tag Definitions for BloomSuite
 * 
 * Central registry of all available merge tags with metadata for UI display
 */

export interface MergeTagDefinition {
  key: string;
  label: string;
  description: string;
  category: MergeTagCategory;
  defaultFallback: string;
  example: string;
}

export type MergeTagCategory = 
  | 'contact'
  | 'purchase'
  | 'loyalty'
  | 'custom'
  | 'company'
  | 'system';

export const CATEGORY_LABELS: Record<MergeTagCategory, string> = {
  contact: 'Contact Info',
  purchase: 'Purchase History',
  loyalty: 'Loyalty & Engagement',
  custom: 'Custom Fields',
  company: 'Company Info',
  system: 'System',
};

export const CATEGORY_ORDER: MergeTagCategory[] = [
  'contact',
  'purchase',
  'loyalty',
  'custom',
  'company',
  'system',
];

/**
 * All available merge tags
 */
export const MERGE_TAG_DEFINITIONS: MergeTagDefinition[] = [
  // Contact Info
  {
    key: 'first_name',
    label: 'First Name',
    description: "Customer's first name",
    category: 'contact',
    defaultFallback: 'Friend',
    example: 'Sarah',
  },
  {
    key: 'last_name',
    label: 'Last Name',
    description: "Customer's last name",
    category: 'contact',
    defaultFallback: 'Customer',
    example: 'Johnson',
  },
  {
    key: 'email',
    label: 'Email Address',
    description: "Customer's email address",
    category: 'contact',
    defaultFallback: '',
    example: 'sarah@example.com',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    description: "Customer's phone number",
    category: 'contact',
    defaultFallback: '',
    example: '(555) 123-4567',
  },
  
  // Purchase History
  {
    key: 'lifetime_value',
    label: 'Lifetime Value',
    description: 'Total amount customer has spent',
    category: 'purchase',
    defaultFallback: '0',
    example: '$450.00',
  },
  {
    key: 'total_spent',
    label: 'Total Spent',
    description: 'Total amount spent (same as lifetime value)',
    category: 'purchase',
    defaultFallback: '0',
    example: '$450.00',
  },
  {
    key: 'first_purchase_date',
    label: 'First Purchase Date',
    description: 'Date of first purchase',
    category: 'purchase',
    defaultFallback: '',
    example: 'March 15, 2024',
  },
  {
    key: 'last_purchase_date',
    label: 'Last Purchase Date',
    description: 'Date of most recent purchase',
    category: 'purchase',
    defaultFallback: '',
    example: 'November 20, 2024',
  },
  
  // Loyalty & Engagement
  {
    key: 'custom.membership_level',
    label: 'Membership Level',
    description: 'Customer loyalty tier',
    category: 'loyalty',
    defaultFallback: '',
    example: 'Gold',
  },
  {
    key: 'custom.points_balance',
    label: 'Points Balance',
    description: 'Current loyalty points',
    category: 'loyalty',
    defaultFallback: '0',
    example: '1,250',
  },
  
  // Custom Fields
  {
    key: 'custom.date_of_birth',
    label: 'Birthday',
    description: "Customer's date of birth",
    category: 'custom',
    defaultFallback: '',
    example: 'June 15',
  },
  {
    key: 'custom.favorite_plant',
    label: 'Favorite Plant',
    description: "Customer's favorite plant type",
    category: 'custom',
    defaultFallback: '',
    example: 'Roses',
  },
  {
    key: 'custom.garden_size',
    label: 'Garden Size',
    description: "Size of customer's garden",
    category: 'custom',
    defaultFallback: '',
    example: 'Large',
  },
  
  // Company Info
  {
    key: 'company.name',
    label: 'Company Name',
    description: 'Your business name',
    category: 'company',
    defaultFallback: 'Our Team',
    example: 'Green Thumb Gardens',
  },
  {
    key: 'company.address',
    label: 'Company Address',
    description: 'Your business address',
    category: 'company',
    defaultFallback: '',
    example: '123 Garden Way, Plantville, CA',
  },
  {
    key: 'company.phone',
    label: 'Company Phone',
    description: 'Your business phone number',
    category: 'company',
    defaultFallback: '',
    example: '(555) 987-6543',
  },
  {
    key: 'company.email',
    label: 'Company Email',
    description: 'Your business email',
    category: 'company',
    defaultFallback: '',
    example: 'hello@gardencenter.com',
  },
  {
    key: 'company.website',
    label: 'Company Website',
    description: 'Your business website',
    category: 'company',
    defaultFallback: '',
    example: 'www.gardencenter.com',
  },
  
  // System
  {
    key: 'system.unsubscribe_url',
    label: 'Unsubscribe Link',
    description: 'Link to unsubscribe from emails',
    category: 'system',
    defaultFallback: '#',
    example: '[Unsubscribe]',
  },
  {
    key: 'system.preferences_url',
    label: 'Preferences Link',
    description: 'Link to manage email preferences',
    category: 'system',
    defaultFallback: '#',
    example: '[Manage Preferences]',
  },
  {
    key: 'system.current_year',
    label: 'Current Year',
    description: 'The current year',
    category: 'system',
    defaultFallback: new Date().getFullYear().toString(),
    example: '2024',
  },
  {
    key: 'system.current_date',
    label: 'Current Date',
    description: "Today's date",
    category: 'system',
    defaultFallback: '',
    example: 'December 5, 2024',
  },
  {
    key: 'system.date_plus_3',
    label: 'Date + 3 Days',
    description: 'Current date plus 3 days',
    category: 'system',
    defaultFallback: '',
    example: 'December 8, 2024',
  },
  {
    key: 'system.date_plus_7',
    label: 'Date + 7 Days',
    description: 'Current date plus 1 week',
    category: 'system',
    defaultFallback: '',
    example: 'December 12, 2024',
  },
  {
    key: 'system.date_plus_14',
    label: 'Date + 14 Days',
    description: 'Current date plus 2 weeks',
    category: 'system',
    defaultFallback: '',
    example: 'December 19, 2024',
  },
  {
    key: 'system.date_plus_30',
    label: 'Date + 30 Days',
    description: 'Current date plus 30 days',
    category: 'system',
    defaultFallback: '',
    example: 'January 4, 2025',
  },
];

/**
 * Get all merge tags grouped by category
 */
export function getMergeTagsByCategory(): Record<MergeTagCategory, MergeTagDefinition[]> {
  const grouped: Record<MergeTagCategory, MergeTagDefinition[]> = {
    contact: [],
    purchase: [],
    loyalty: [],
    custom: [],
    company: [],
    system: [],
  };
  
  for (const tag of MERGE_TAG_DEFINITIONS) {
    grouped[tag.category].push(tag);
  }
  
  return grouped;
}

/**
 * Get a merge tag definition by key
 */
export function getMergeTagByKey(key: string): MergeTagDefinition | undefined {
  return MERGE_TAG_DEFINITIONS.find(tag => tag.key === key);
}

/**
 * Get all available tag keys
 */
export function getAllMergeTagKeys(): string[] {
  return MERGE_TAG_DEFINITIONS.map(tag => tag.key);
}

/**
 * Format a tag key into the full syntax with default fallback
 */
export function formatTagWithDefault(key: string): string {
  const definition = getMergeTagByKey(key);
  const fallback = definition?.defaultFallback || '';
  
  if (fallback) {
    return `{{ ${key} | default: "${fallback}" }}`;
  }
  
  return `{{ ${key} }}`;
}

/**
 * Format a tag key into simple syntax (no default)
 */
export function formatTagSimple(key: string): string {
  return `{{ ${key} }}`;
}
