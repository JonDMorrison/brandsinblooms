import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CRM = 'udldmkqwnxhdeztyqcau';
const CMS = 'isvcjikzheswgvpkfpfr';
const OPS_URL = 'https://bloomsites.app/api/internal/bloom/ops';
const INTAKE_URL = `https://${CRM}.supabase.co/functions/v1/bloom-support-intake`;
const names = ['bloom_support_intake_cms', 'bloom_support_ops_cms'];

// Uses the existing deployment credential, only fixed projects, and dedicated
// Bloom entries. Never read maintenance credentials or log secret values.
export async function configureCms({ token, request = fetch }) {
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not configured');
  const management = async (project, path, body) => {
    if (![CRM, CMS].includes(project)) throw new Error('Unexpected project');
    const response = await request(`https://api.supabase.com/v1/projects/${project}${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Bloom CMS configuration: HTTP ${response.status}`);
    return response;
  };
  const stored = await management(CRM, '/database/query', { query: `
    DO $bloom$ DECLARE n text; BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('bloom-support-cms-configuration'));
      FOREACH n IN ARRAY ARRAY['bloom_support_intake_cms','bloom_support_ops_cms'] LOOP
        IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = n) THEN
          PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),n,'Dedicated Bloom CMS signing secret');
        END IF;
      END LOOP;
    END $bloom$;
    SELECT name,decrypted_secret AS value FROM vault.decrypted_secrets
    WHERE name IN ('bloom_support_intake_cms','bloom_support_ops_cms');
  ` });
  const rows = await stored.json().catch(() => null);
  if (!Array.isArray(rows) || rows.length !== 2 || names.some(name => rows.filter(row =>
    row.name === name && typeof row.value === 'string' && /^[a-f0-9]{64}$/.test(row.value)).length !== 1)) {
    throw new Error('Dedicated Bloom CMS signing secrets are invalid');
  }
  const intake = rows.find(row => row.name === names[0]).value;
  const ops = rows.find(row => row.name === names[1]).value;
  // Values are fixed HTTPS URL or strictly validated hexadecimal strings.
  // Existing dedicated entries are aligned; no unrelated Vault entry is touched.
  const entries = [...rows, { name: 'bloom_support_intake_url', value: INTAKE_URL }];
  const values = entries.map(row => `('${row.name}','${row.value}')`).join(',');
  await management(CMS, '/database/query', { query: `
    DO $bloom$ DECLARE item record; existing_id uuid; BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('bloom-support-cms-configuration'));
      FOR item IN SELECT * FROM (VALUES ${values}) AS v(name,value) LOOP
        SELECT id INTO existing_id FROM vault.secrets WHERE name = item.name;
        IF existing_id IS NULL THEN
          PERFORM vault.create_secret(item.value,item.name,'Dedicated Bloom Support connection');
        ELSE
          PERFORM vault.update_secret(existing_id,item.value);
        END IF;
      END LOOP;
    END $bloom$;
  ` });
  await management(CRM, '/secrets', [
    { name: 'BLOOM_INTAKE_SECRET_CMS', value: intake },
    { name: 'BLOOM_OPS_SECRET_CMS', value: ops },
    { name: 'BLOOM_OPS_URL_CMS', value: OPS_URL },
  ]);
  // Read-only negative tenant probe. A real JSON tenant-guard rejection proves
  // HMAC authentication; a missing HTML route means release is still required.
  const body = JSON.stringify({ action: 'site.read', site_id: '00000000-0000-0000-0000-000000000000' });
  const unsigned = await request(OPS_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const unsignedData = await unsigned.json().catch(() => null);
  if ((unsigned.status === 404 && unsignedData === null) || (unsigned.status === 503 && unsignedData?.error === 'not_configured')) {
    return { configurationPrepared: true, signedTenantGuardVerified: false, productionConnected: false, releaseRequired: true };
  }
  if (unsigned.status !== 401 || unsignedData?.error !== 'unauthenticated') {
    throw new Error(`CMS unsigned-request verification failed: HTTP ${unsigned.status}`);
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', ops).update(`${timestamp}.${body}`).digest('hex');
  const probe = await request(OPS_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bloom-timestamp': timestamp, 'x-bloom-signature': signature },
    body, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const data = await probe.json().catch(() => null);
  const verified = probe.status === 404 && data?.error === 'not_found';
  const releaseRequired = (probe.status === 404 && data === null) || (probe.status === 503 && data?.error === 'not_configured');
  if (!verified && !releaseRequired) throw new Error(`CMS signed tenant-guard verification failed: HTTP ${probe.status}`);
  return { configurationPrepared: true, signedTenantGuardVerified: verified, productionConnected: verified, releaseRequired };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await configureCms({ token: process.env.SUPABASE_ACCESS_TOKEN }))); }
  catch { console.error('Bloom CMS configuration failed; check dedicated Vault entries and fixed-project deployment permissions.'); process.exitCode = 1; }
}
