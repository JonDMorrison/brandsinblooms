interface ImportAccessClient {
  rpc(name: 'get_current_crm_access'): PromiseLike<{ data: unknown; error: unknown }>;
}
/** Call only with the bearer-authenticated client after auth.getUser(). Never pass a service client. */
export async function requireImportTenant(client: ImportAccessClient): Promise<string> {
  const { data, error } = await client.rpc('get_current_crm_access');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Integration management permission required.');
  const access = data as Record<string, unknown>;
  if (typeof access.tenantId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(access.tenantId)
      || !Array.isArray(access.permissions) || !access.permissions.includes('integrations.manage')) throw new Error('Integration management permission required.');
  return access.tenantId;
}
