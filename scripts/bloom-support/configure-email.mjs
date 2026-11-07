import { createHmac, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CRM = 'udldmkqwnxhdeztyqcau';
const managementBase = `https://api.supabase.com/v1/projects/${CRM}`;

export async function configureEmail({ token, request = fetch }) {
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not configured');
  const management = async (path, body) => {
    const response = await request(managementBase + path, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Bloom email configuration ${path}: HTTP ${response.status}`);
    return response;
  };
  const stored = await management('/database/query', { query: "select decrypted_secret as value from vault.decrypted_secrets where name='bloom_support_resend_inbound_webhook'" });
  const rows = await stored.json();
  if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0].value !== 'string' || !/^whsec_[A-Za-z0-9+/=_-]{24,}$/.test(rows[0].value)) {
    throw new Error('The dedicated Bloom Support webhook signing secret must exist in CRM Vault');
  }
  const secret = rows[0].value;
  await management('/secrets', [
    { name: 'RESEND_INBOUND_WEBHOOK_SECRET', value: secret },
    { name: 'BLOOM_SUPPORT_INBOX', value: 'bloom@support.bloomsuite.app' },
    { name: 'BLOOM_SUPPORT_PUBLIC_INBOX', value: 'bloom@bloomsuite.app' },
    // Keep the provider address as a recovery route while the root-domain
    // address offers customers a short, memorable way to reach Bloom.
    { name: 'BLOOM_SUPPORT_INBOUND_ADDRESSES', value: '0dc2823a@eeuntaiurk.resend.app,bloom@bloomsuite.app' },
    // The production round-trip verification is complete. Customer email still
    // requires the separately controlled client_email_enabled switch.
    { name: 'BLOOM_SUPPORT_EMAIL_ALLOWLIST', value: '' },
  ]);
  // Signature verification is tested without filing a ticket or sending mail.
  const body = JSON.stringify({ type: 'bloom.configuration.check' });
  const eventId = `bloom-setup-${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${eventId}.${timestamp}.${body}`).digest('base64');
  const probe = await request(`https://${CRM}.supabase.co/functions/v1/bloom-support-email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'svix-id': eventId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
    body, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const data = await probe.json().catch(() => null);
  if (probe.status !== 200 || data?.ignored !== 'event bloom.configuration.check') throw new Error(`Bloom email signature verification failed: HTTP ${probe.status}`);
  return { webhookConfigured: true, signatureVerified: true, clientEmailEnabledByThisSetup: false, deliveryRestriction: 'none; client email switch unchanged' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await configureEmail({ token: process.env.SUPABASE_ACCESS_TOKEN })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bloom email configuration failed');
    process.exitCode = 1;
  }
}
