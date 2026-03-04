export interface EmailGovernanceRuntimeConfig {
  batch: {
    max_batch_size: number;
    delay_min_seconds: number;
    delay_max_seconds: number;
  };
  compliance: {
    high_volume_threshold: number;
    spam_score_threshold: number;
  };
  list_hygiene: {
    invalid_block_threshold_pct: number;
    inactive_warning_threshold_pct: number;
    bounce_warning_threshold_pct: number;
    inactive_days: number;
  };
}

const CACHE_TTL_MS = 15_000;
const configCache = new Map<string, { value: EmailGovernanceRuntimeConfig; until: number }>();

type GovernanceConfigClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { value?: unknown } | null; error: { message: string } | null }>;
      };
    };
  };
  rpc?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getEmailGovernanceRuntimeConfig(
  supabase: GovernanceConfigClient,
  tenantId?: string | null,
): Promise<EmailGovernanceRuntimeConfig> {
  const now = Date.now();
  const cacheKey = tenantId || '__global__';
  const cached = configCache.get(cacheKey);
  if (cached && now < cached.until) {
    return cached.value;
  }

  const runtimeResponse = supabase.rpc
    ? await supabase.rpc('get_email_governance_effective_runtime_config', { p_tenant_id: tenantId ?? null })
    : { data: null, error: { message: 'rpc method not available' } };

  const effectiveRuntimeConfig = runtimeResponse.data;
  const runtimeConfigError = runtimeResponse.error;

  let value: Record<string, unknown>;

  if (!runtimeConfigError && effectiveRuntimeConfig && typeof effectiveRuntimeConfig === 'object') {
    value = effectiveRuntimeConfig as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'email_governance_config')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load email governance config: ${error.message}`);
    }

    value = (data?.value || {}) as Record<string, unknown>;
  }

  const batch = (value.batch || {}) as Record<string, unknown>;
  const compliance = (value.compliance || {}) as Record<string, unknown>;
  const listHygiene = (value.list_hygiene || {}) as Record<string, unknown>;

  const runtimeConfig: EmailGovernanceRuntimeConfig = {
    batch: {
      max_batch_size: asNumber(batch.max_batch_size, 5000),
      delay_min_seconds: asNumber(batch.delay_min_seconds, 60),
      delay_max_seconds: asNumber(batch.delay_max_seconds, 120),
    },
    compliance: {
      high_volume_threshold: asNumber(compliance.high_volume_threshold, 50000),
      spam_score_threshold: asNumber(compliance.spam_score_threshold, 5),
    },
    list_hygiene: {
      invalid_block_threshold_pct: asNumber(listHygiene.invalid_block_threshold_pct, 5),
      inactive_warning_threshold_pct: asNumber(listHygiene.inactive_warning_threshold_pct, 10),
      bounce_warning_threshold_pct: asNumber(listHygiene.bounce_warning_threshold_pct, 2),
      inactive_days: asNumber(listHygiene.inactive_days, 90),
    },
  };

  if (runtimeConfig.batch.delay_min_seconds > runtimeConfig.batch.delay_max_seconds) {
    throw new Error('Invalid governance config: batch.delay_min_seconds must be <= batch.delay_max_seconds');
  }

  configCache.set(cacheKey, { value: runtimeConfig, until: now + CACHE_TTL_MS });
  return runtimeConfig;
}
