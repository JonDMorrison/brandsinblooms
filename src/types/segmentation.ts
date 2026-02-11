// ============================================
// Intelligent Segmentation Module Types
// ============================================

export type SegmentType = 'dynamic' | 'frozen';
export type SegmentVisibility = 'private' | 'team' | 'public';
export type ConditionLogic = 'AND' | 'OR';

// Condition operators
export type ConditionOperator =
  | 'equals' | 'eq' | '='
  | 'not_equals' | 'neq' | '!='
  | 'greater_than' | 'gt' | '>'
  | 'greater_than_or_equal' | 'gte' | '>='
  | 'less_than' | 'lt' | '<'
  | 'less_than_or_equal' | 'lte' | '<='
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | 'is_true'
  | 'is_false'
  | 'between'
  | 'days_ago_less_than'
  | 'days_ago_greater_than';

// Single condition
export interface SegmentCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: any;
}

// Group of conditions with logic
export interface SegmentConditionGroup {
  id: string;
  logic: ConditionLogic;
  conditions: (SegmentCondition | SegmentConditionGroup)[];
}

// Segment rules structure
export interface SegmentRules {
  logic: ConditionLogic;
  conditions: SegmentCondition[];
  groups?: SegmentConditionGroup[];
}

// Extended segment type with new fields
export interface EnhancedSegment {
  id: string;
  name: string;
  description?: string;
  tenant_id: string;
  user_id?: string;
  segment_type: SegmentType;
  visibility: SegmentVisibility;
  conditions: SegmentRules | null;
  customer_count: number;
  is_active: boolean;
  is_system_segment?: boolean;
  auto_update: boolean;
  persona_id?: string;
  metadata?: Record<string, any>;
  ai_generated_description?: string;
  entry_count: number;
  exit_count: number;
  last_evaluated_at?: string;
  evaluation_frequency_minutes: number;
  created_at: string;
  updated_at: string;
}

// Segment evaluation log
export interface SegmentEvaluationLog {
  id: string;
  segment_id: string;
  tenant_id: string;
  evaluated_at: string;
  previous_count: number;
  new_count: number;
  customers_entered: string[];
  customers_exited: string[];
  evaluation_duration_ms: number;
  rules_evaluated?: SegmentRules;
  error_message?: string;
  created_at: string;
}

// Customer segment membership
export interface CustomerSegmentMembership {
  id: string;
  customer_id: string;
  segment_id: string;
  tenant_id: string;
  entered_at: string;
  exited_at?: string;
  entry_reason?: Record<string, any>;
  exit_reason?: Record<string, any>;
  is_manual: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Customer risk signals
export interface CustomerRiskSignals {
  id: string;
  customer_id: string;
  tenant_id: string;
  rapid_opt_out_score: number;
  message_ignore_streak: number;
  coupon_abuse_flag: boolean;
  coupon_abuse_count: number;
  hard_bounce_count: number;
  soft_bounce_count: number;
  inactivity_days: number;
  complaint_count: number;
  overall_risk_score: number;
  churn_probability: number;
  engagement_decay_rate: number;
  risk_factors: string[];
  last_calculated_at?: string;
  calculation_version: number;
  created_at: string;
  updated_at: string;
}

// Metric category for UI organization
export type MetricCategory =
  | 'identity'
  | 'email_engagement'
  | 'sms_engagement'
  | 'cross_channel'
  | 'purchase'
  | 'loyalty'
  | 'lifecycle'
  | 'risk';

// Metric field definition for rule builder
export interface MetricFieldDefinition {
  field: string;
  label: string;
  category: MetricCategory;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  operators: ConditionOperator[];
  defaultOperator: ConditionOperator;
  valueOptions?: { label: string; value: any }[];
  placeholder?: string;
  unit?: string;
}

// Segment simulation result
export interface SegmentSimulationResult {
  estimatedCount: number;
  sampleCustomers: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    matchedConditions: string[];
  }[];
  entryRate: number;
  exitRate: number;
  overlappingSegments: {
    id: string;
    name: string;
    overlapCount: number;
  }[];
  conflictWarnings: string[];
}

// Evaluation engine result
export interface SegmentEvaluationResult {
  success: boolean;
  evaluated: number;
  duration_ms: number;
  results: {
    segment_id: string;
    segment_name: string;
    previous_count: number;
    new_count: number;
    entered: number;
    exited: number;
    duration_ms: number;
    error?: string;
  }[];
}

// Risk calculation result
export interface RiskCalculationResult {
  success: boolean;
  processed: number;
  duration_ms: number;
}