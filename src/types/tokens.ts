
export interface TokenBalance {
  tokens_balance: number;
  tokens_reset_at: string;
  is_trial: boolean;
}

export interface TokenUsage {
  id: string;
  action_type: string;
  tokens_consumed: number;
  tokens_remaining: number;
  content_type: string | null;
  created_at: string;
}

export interface TokenStats {
  usagePercent: number;
  resetTime: string;
  isInOverage: boolean;
  overageAmount: number;
  overageCost: number;
}
