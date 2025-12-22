import type { MetricFieldDefinition, ConditionOperator } from '@/types/segmentation';

// Standard operators for different field types
const stringOperators: ConditionOperator[] = [
  'equals', 'not_equals', 'contains', 'not_contains', 
  'starts_with', 'ends_with', 'is_empty', 'is_not_empty'
];

const numberOperators: ConditionOperator[] = [
  'equals', 'not_equals', 'greater_than', 'greater_than_or_equal',
  'less_than', 'less_than_or_equal', 'between'
];

const booleanOperators: ConditionOperator[] = ['is_true', 'is_false'];

const dateOperators: ConditionOperator[] = [
  'days_ago_less_than', 'days_ago_greater_than', 'is_empty', 'is_not_empty'
];

const arrayOperators: ConditionOperator[] = [
  'contains', 'not_contains', 'is_empty', 'is_not_empty'
];

/**
 * Complete catalog of available metrics for segment rule builder
 */
export const METRICS_CATALOG: MetricFieldDefinition[] = [
  // ==========================================
  // IDENTITY & PROFILE
  // ==========================================
  {
    field: 'email',
    label: 'Email Address',
    category: 'identity',
    description: 'Customer email address',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'contains',
    placeholder: 'e.g., @gmail.com'
  },
  {
    field: 'first_name',
    label: 'First Name',
    category: 'identity',
    description: 'Customer first name',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'is_not_empty'
  },
  {
    field: 'last_name',
    label: 'Last Name',
    category: 'identity',
    description: 'Customer last name',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'is_not_empty'
  },
  {
    field: 'phone',
    label: 'Phone Number',
    category: 'identity',
    description: 'Customer phone number',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'is_not_empty'
  },
  {
    field: 'city',
    label: 'City',
    category: 'identity',
    description: 'Customer city',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'equals'
  },
  {
    field: 'state_region',
    label: 'State/Region',
    category: 'identity',
    description: 'Customer state or region',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'equals'
  },
  {
    field: 'country_code',
    label: 'Country',
    category: 'identity',
    description: 'Customer country code',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'equals'
  },
  {
    field: 'postal_code',
    label: 'Postal Code',
    category: 'identity',
    description: 'Customer postal/zip code',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'starts_with'
  },
  {
    field: 'signup_source',
    label: 'Signup Source',
    category: 'identity',
    description: 'How the customer signed up',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'equals',
    valueOptions: [
      { label: 'Website', value: 'website' },
      { label: 'POS', value: 'pos' },
      { label: 'Import', value: 'import' },
      { label: 'Manual', value: 'manual' },
      { label: 'API', value: 'api' }
    ]
  },
  {
    field: 'created_at',
    label: 'Account Age',
    category: 'identity',
    description: 'When the customer account was created',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_greater_than',
    unit: 'days'
  },
  {
    field: 'tags',
    label: 'Tags',
    category: 'identity',
    description: 'Customer tags',
    type: 'array',
    operators: arrayOperators,
    defaultOperator: 'contains'
  },

  // ==========================================
  // EMAIL ENGAGEMENT
  // ==========================================
  {
    field: 'email_opt_in',
    label: 'Email Opt-in',
    category: 'email_engagement',
    description: 'Customer has opted in to email',
    type: 'boolean',
    operators: booleanOperators,
    defaultOperator: 'is_true'
  },
  {
    field: 'total_emails_sent',
    label: 'Emails Sent',
    category: 'email_engagement',
    description: 'Total emails sent to customer',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than'
  },
  {
    field: 'total_emails_opened',
    label: 'Emails Opened',
    category: 'email_engagement',
    description: 'Total emails opened by customer',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than'
  },
  {
    field: 'total_emails_clicked',
    label: 'Emails Clicked',
    category: 'email_engagement',
    description: 'Total email clicks by customer',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than'
  },
  {
    field: 'email_open_rate',
    label: 'Email Open Rate',
    category: 'email_engagement',
    description: 'Percentage of emails opened',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than',
    unit: '%'
  },
  {
    field: 'email_click_rate',
    label: 'Email Click Rate',
    category: 'email_engagement',
    description: 'Percentage of emails clicked',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than',
    unit: '%'
  },
  {
    field: 'email_engagement_score',
    label: 'Email Engagement Score',
    category: 'email_engagement',
    description: 'Overall email engagement score (0-100)',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than'
  },
  {
    field: 'last_email_sent_at',
    label: 'Last Email Sent',
    category: 'email_engagement',
    description: 'When the last email was sent',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_less_than',
    unit: 'days'
  },
  {
    field: 'last_open_at',
    label: 'Last Email Opened',
    category: 'email_engagement',
    description: 'When the last email was opened',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_less_than',
    unit: 'days'
  },
  {
    field: 'last_email_clicked_at',
    label: 'Last Email Clicked',
    category: 'email_engagement',
    description: 'When the last email link was clicked',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_less_than',
    unit: 'days'
  },
  {
    field: 'total_emails_bounced',
    label: 'Emails Bounced',
    category: 'email_engagement',
    description: 'Total bounced emails',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'equals'
  },
  {
    field: 'total_hard_bounces',
    label: 'Hard Bounces',
    category: 'email_engagement',
    description: 'Total hard bounces',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'equals'
  },

  // ==========================================
  // SMS ENGAGEMENT
  // ==========================================
  {
    field: 'sms_opt_in',
    label: 'SMS Opt-in',
    category: 'sms_engagement',
    description: 'Customer has opted in to SMS',
    type: 'boolean',
    operators: booleanOperators,
    defaultOperator: 'is_true'
  },
  {
    field: 'preferred_channel',
    label: 'Preferred Channel',
    category: 'cross_channel',
    description: 'Customer preferred communication channel',
    type: 'string',
    operators: stringOperators,
    defaultOperator: 'equals',
    valueOptions: [
      { label: 'Email', value: 'email' },
      { label: 'SMS', value: 'sms' },
      { label: 'Both', value: 'both' }
    ]
  },

  // ==========================================
  // PURCHASE BEHAVIOR
  // ==========================================
  {
    field: 'total_spent',
    label: 'Total Spent',
    category: 'purchase',
    description: 'Total amount spent by customer',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than',
    unit: '$'
  },
  {
    field: 'lifetime_value',
    label: 'Lifetime Value',
    category: 'purchase',
    description: 'Customer lifetime value',
    type: 'number',
    operators: numberOperators,
    defaultOperator: 'greater_than',
    unit: '$'
  },
  {
    field: 'first_purchase_date',
    label: 'First Purchase',
    category: 'purchase',
    description: 'Date of first purchase',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_greater_than',
    unit: 'days'
  },
  {
    field: 'last_purchase_date',
    label: 'Last Purchase',
    category: 'purchase',
    description: 'Date of last purchase',
    type: 'date',
    operators: dateOperators,
    defaultOperator: 'days_ago_less_than',
    unit: 'days'
  },
  {
    field: 'is_vip',
    label: 'VIP Status',
    category: 'purchase',
    description: 'Customer is a VIP',
    type: 'boolean',
    operators: booleanOperators,
    defaultOperator: 'is_true'
  },
  {
    field: 'product_tags',
    label: 'Product Interests',
    category: 'purchase',
    description: 'Product categories customer is interested in',
    type: 'array',
    operators: arrayOperators,
    defaultOperator: 'contains'
  },

  // ==========================================
  // RISK SIGNALS
  // ==========================================
  {
    field: 'suppressed',
    label: 'Suppressed',
    category: 'risk',
    description: 'Customer is suppressed from communications',
    type: 'boolean',
    operators: booleanOperators,
    defaultOperator: 'is_false'
  },
  {
    field: 'opt_out',
    label: 'Opted Out',
    category: 'risk',
    description: 'Customer has opted out completely',
    type: 'boolean',
    operators: booleanOperators,
    defaultOperator: 'is_false'
  }
];

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: string): MetricFieldDefinition[] {
  return METRICS_CATALOG.filter(m => m.category === category);
}

/**
 * Get a specific metric definition by field name
 */
export function getMetricDefinition(field: string): MetricFieldDefinition | undefined {
  return METRICS_CATALOG.find(m => m.field === field);
}

/**
 * Get all available categories
 */
export function getCategories(): { id: string; label: string; icon: string }[] {
  return [
    { id: 'identity', label: 'Identity & Profile', icon: 'User' },
    { id: 'email_engagement', label: 'Email Engagement', icon: 'Mail' },
    { id: 'sms_engagement', label: 'SMS Engagement', icon: 'MessageSquare' },
    { id: 'cross_channel', label: 'Cross-Channel', icon: 'Share2' },
    { id: 'purchase', label: 'Purchase Behavior', icon: 'ShoppingCart' },
    { id: 'loyalty', label: 'Loyalty & Perks', icon: 'Award' },
    { id: 'lifecycle', label: 'Lifecycle', icon: 'TrendingUp' },
    { id: 'risk', label: 'Risk Signals', icon: 'AlertTriangle' }
  ];
}

/**
 * Get operator label for display
 */
export function getOperatorLabel(operator: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    'equals': 'equals',
    'eq': 'equals',
    '=': 'equals',
    'not_equals': 'does not equal',
    'neq': 'does not equal',
    '!=': 'does not equal',
    'greater_than': 'is greater than',
    'gt': 'is greater than',
    '>': 'is greater than',
    'greater_than_or_equal': 'is at least',
    'gte': 'is at least',
    '>=': 'is at least',
    'less_than': 'is less than',
    'lt': 'is less than',
    '<': 'is less than',
    'less_than_or_equal': 'is at most',
    'lte': 'is at most',
    '<=': 'is at most',
    'contains': 'contains',
    'not_contains': 'does not contain',
    'starts_with': 'starts with',
    'ends_with': 'ends with',
    'is_empty': 'is empty',
    'is_not_empty': 'is not empty',
    'in': 'is one of',
    'not_in': 'is not one of',
    'is_true': 'is true',
    'is_false': 'is false',
    'between': 'is between',
    'days_ago_less_than': 'is within the last',
    'days_ago_greater_than': 'is more than'
  };
  return labels[operator] || operator;
}