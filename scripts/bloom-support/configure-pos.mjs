import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CRM = 'udldmkqwnxhdeztyqcau';
const POS = 'aimphmbjuawmxyvkwipf';
const API = 'https://api.supabase.com/v1/projects/';
const vaultNames = ['bloom_support_intake_pos', 'bloom_support_ops_pos'];

// Runs only in the trusted production deployment workflow. It uses the same
// existing Management API credential as the CRM release, and reads only the two
// dedicated Bloom signing secrets. Never print provider response bodies or values.
export async function configurePos({ token, request = fetch }) {
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not configured');
  const management = async (project, path, body) => {
    if (![CRM, POS].includes(project)) throw new Error('Unexpected project');
    const result = await request(API + project + path, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30_000), redirect: 'error',
    });
    if (!result.ok) throw new Error(`Bloom configuration ${project}${path}: HTTP ${result.status}`);
    return result;
  };
  const result = await management(CRM, '/database/query', {
    query: "select name,decrypted_secret as value from vault.decrypted_secrets where name in ('bloom_support_intake_pos','bloom_support_ops_pos')",
  });
  const rows = await result.json();
  if (!Array.isArray(rows) || rows.length !== 2 || vaultNames.some(name => rows.filter(row => row.name === name && typeof row.value === 'string' && /^[a-f0-9]{64}$/.test(row.value)).length !== 1)) {
    throw new Error('The two dedicated Bloom signing secrets must exist in CRM Vault');
  }
  const intake = rows.find(row => row.name === vaultNames[0]).value;
  const ops = rows.find(row => row.name === vaultNames[1]).value;
  await management(POS, '/secrets', [
    { name: 'BLOOM_SUPPORT_INTAKE_URL', value: `https://${CRM}.supabase.co/functions/v1/bloom-support-intake` },
    { name: 'BLOOM_INTAKE_SECRET_POS', value: intake },
    { name: 'BLOOM_OPS_SECRET_POS', value: ops },
  ]);
  await management(CRM, '/secrets', [
    { name: 'BLOOM_INTAKE_SECRET_POS', value: intake },
    { name: 'BLOOM_OPS_URL_POS', value: `https://${POS}.supabase.co/functions/v1/bloom-support-ops` },
    { name: 'BLOOM_OPS_SECRET_POS', value: ops },
  ]);
  // Positive HMAC check with a nonexistent business: it must pass signature
  // validation, then hit the existing RPC's tenant guard. No records are created
  // or client data read. A 401 must never be reported as a successful connection.
  const endpoint = `https://${POS}.supabase.co/functions/v1/bloom-support-ops`;
  const body = JSON.stringify({ action: 'pos.products', pos_tenant_id: '00000000-0000-0000-0000-000000000000', actor: { principal_id: '00000000-0000-4000-8000-000000000001', name: 'Deployment verification' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', ops).update(`${timestamp}.${body}`).digest('hex');
  const probe = await request(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bloom-timestamp': timestamp, 'x-bloom-signature': signature },
    body, signal: AbortSignal.timeout(30_000), redirect: 'error',
  });
  const probeBody = await probe.json().catch(() => null);
  if (probe.status !== 404 || probeBody?.error !== 'not_found') throw new Error(`Signed POS tenant-guard verification failed: HTTP ${probe.status}`);
  return { configured: ['CRM POS intake', 'CRM POS operations', 'POS signed reporting', 'POS signed operations'], signedTenantGuardVerified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const outcome = await configurePos({ token: process.env.SUPABASE_ACCESS_TOKEN });
    console.log(JSON.stringify(outcome));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bloom POS configuration failed');
    process.exitCode = 1;
  }
}
