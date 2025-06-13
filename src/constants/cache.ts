
export const CACHE_KEYS = {
  campaigns: 'dashboard_campaigns_cache',
  tasks: 'dashboard_tasks_cache',
  token_balance: 'token_balance_cache',
  token_usage: 'token_usage_cache',
} as const;

export const CACHE_DURATION = 3600000; // 1 hour
