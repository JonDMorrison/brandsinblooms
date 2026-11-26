interface TenantScopeOptions {
  tenantId?: string | null;
  userId?: string | null;
}

interface ScopeableQuery<TSelf> {
  eq(column: "tenant_id", value: string): TSelf;
  or(filters: string): TSelf;
}

export function buildTenantUserScopeFilter(options: TenantScopeOptions) {
  if (!options.userId || options.tenantId) {
    return null;
  }

  return `and(tenant_id.is.null,user_id.eq.${options.userId})`;
}

export function applyTenantUserScope<TQuery extends ScopeableQuery<TQuery>>(
  query: TQuery,
  options: TenantScopeOptions,
): TQuery {
  if (options.tenantId) {
    return query.eq("tenant_id", options.tenantId);
  }

  const filter = buildTenantUserScopeFilter(options);

  if (!filter) {
    return query;
  }

  return query.or(filter);
}

export function buildRealtimeScopeFilter(options: TenantScopeOptions) {
  if (options.tenantId) {
    return `tenant_id=eq.${options.tenantId}`;
  }

  if (options.userId) {
    return `user_id=eq.${options.userId}`;
  }

  return null;
}

export function buildScopedStorageKey(
  prefix: string,
  options: TenantScopeOptions,
) {
  return `${prefix}:${options.userId ?? "anonymous"}:${options.tenantId ?? "personal"}`;
}
