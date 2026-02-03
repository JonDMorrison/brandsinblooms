/**
 * Centralized segment definitions - Single source of truth for all predefined segments
 * This file contains both the segment metadata and their rule conditions
 */

export interface SegmentCondition {
  field: string;
  operator: string;
  value: string | number | boolean | string[];
}

export interface SegmentDefinition {
  id: string;
  name: string;
  description: string;
  icon: 'crown' | 'trending' | 'users' | 'mail' | 'gift' | 'shopping';
  is_system: boolean;
  conditions: {
    rules: SegmentCondition[];
    logic: 'AND' | 'OR';
  };
  // Future: engagement-based criteria
  engagement_criteria?: {
    email_open_rate_min?: number;
    email_click_rate_min?: number;
    days_since_last_engagement_max?: number;
    engagement_score_min?: number;
  };
}

export const SYSTEM_SEGMENTS: SegmentDefinition[] = [
  {
    id: 'perks-members',
    name: 'Perks Members',
    description: 'Customers enrolled in your Perks loyalty program',
    icon: 'crown',
    is_system: true,
    conditions: {
      rules: [
        { field: 'is_perks_member', operator: '=', value: true }
      ],
      logic: 'AND'
    },
  },
  {
    id: 'loyalty-members',
    name: 'Loyalty Members',
    description: 'Customers enrolled in your loyalty program with active engagement',
    icon: 'crown',
    is_system: true,
    conditions: {
      rules: [
        { field: 'tags', operator: 'contains', value: 'loyalty' }
      ],
      logic: 'OR'
    },
  },
  {
    id: 'high-value',
    name: 'High-Value Customers',
    description: 'Top spending customers who drive significant revenue',
    icon: 'trending',
    is_system: true,
    conditions: {
      rules: [
        { field: 'total_spent', operator: '>', value: 500 }
      ],
      logic: 'AND'
    },
  },
  {
    id: 'new-customers',
    name: 'New Customers',
    description: 'Recent customers who made their first purchase within 30 days',
    icon: 'users',
    is_system: true,
    conditions: {
      rules: [
        { field: 'created_at', operator: 'within_days', value: 30 }
      ],
      logic: 'AND'
    },
  },
  {
    id: 'lapsed-customers',
    name: 'Lapsed Customers',
    description: "Previously active customers who haven't purchased in 90+ days",
    icon: 'mail',
    is_system: true,
    conditions: {
      rules: [
        { field: 'last_purchase_date', operator: 'older_than_days', value: 90 }
      ],
      logic: 'AND'
    },
  },
  {
    id: 'seasonal-shoppers',
    name: 'Seasonal Shoppers',
    description: 'Customers who typically purchase during specific seasons or holidays',
    icon: 'gift',
    is_system: true,
    conditions: {
      rules: [
        { field: 'tags', operator: 'contains_any', value: ['seasonal', 'holiday', 'christmas', 'valentine', 'easter', 'summer', 'winter'] }
      ],
      logic: 'OR'
    },
  },
  {
    id: 'frequent-buyers',
    name: 'Frequent Buyers',
    description: 'Customers with 3+ purchases in the last 6 months',
    icon: 'shopping',
    is_system: true,
    conditions: {
      rules: [
        { field: 'order_count', operator: '>=', value: 3 }
      ],
      logic: 'AND'
    },
  },
];

// Future engagement-based segments (Phase 2+)
export const ENGAGEMENT_SEGMENTS: SegmentDefinition[] = [
  {
    id: 'highly-engaged',
    name: 'Highly Engaged',
    description: 'Customers with high email open rates and recent interactions',
    icon: 'trending',
    is_system: true,
    conditions: {
      rules: [],
      logic: 'AND'
    },
    engagement_criteria: {
      email_open_rate_min: 50,
      days_since_last_engagement_max: 30,
    },
  },
  {
    id: 'at-risk',
    name: 'At Risk',
    description: 'Previously engaged customers showing declining activity',
    icon: 'mail',
    is_system: true,
    conditions: {
      rules: [],
      logic: 'AND'
    },
    engagement_criteria: {
      days_since_last_engagement_max: 60,
      engagement_score_min: 20,
    },
  },
];

// Helper function to get all segments by ID
export const getSegmentById = (id: string): SegmentDefinition | undefined => {
  return [...SYSTEM_SEGMENTS, ...ENGAGEMENT_SEGMENTS].find(s => s.id === id);
};

// Helper function to get segment name by ID
export const getSegmentNameById = (id: string): string => {
  const segment = getSegmentById(id);
  return segment?.name || id;
};
