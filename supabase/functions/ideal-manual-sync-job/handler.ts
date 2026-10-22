import type { createClient as ClientFactory } from '@supabase/supabase-js';
import { requireImportTenant } from '../_shared/customer-intelligence/import-access.ts';
import { MANUAL_SYNC_FAMILIES, MANUAL_SYNC_MAX_BYTES } from '../_shared/customer-intelligence/manual-sync-job-contract.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type' };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const columns = 'id,tenant_id,source_filename,source_sha256,source_bytes,report_family,encoding,status,manifest_sha256,plan_sha256,approval_sha256,review_summary,batch_count,committed_batches,last_error,created_at,updated_at';
export function createManualSyncJobHandler(createClient: typeof ClientFactory, env: (name: string) => string | undefined) {
    return async (req: Request) => {
        if (req.method === 'OPTIONS')
            return new Response(null, { headers: cors });
        if (req.method !== 'POST')
            return reply({ error: 'POST required' }, 405);
        try {
            const auth = req.headers.get('Authorization');
            if (!auth?.startsWith('Bearer '))
                return reply({ error: 'Authentication required' }, 401);
            const url = env('SUPABASE_URL')!, userClient = createClient(url, env('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            if (authError || !user)
                return reply({ error: 'Authentication required' }, 401);
            let tenantId: string;
            try {
                tenantId = await requireImportTenant(userClient);
            }
            catch {
                return reply({ error: 'Integration management permission required' }, 403);
            }
            const body = await req.json();
            if (body.expectedTenantId !== tenantId)
                return reply({ error: 'Selected tenant differs from authorized tenant' }, 403);
            const service = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }), table = () => service.from('ideal_manual_sync_jobs');
            if (body.action === 'list') {
                const { data, error } = await table().select(columns).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
                if (error)
                    throw error;
                return reply({ jobs: data });
            }
            if (body.action === 'create') {
                if (typeof body.filename !== 'string' || !/^([^/\\\x00-\x1f]+)\.(xls|xlsx|csv|txt|tsv)$/i.test(body.filename) || body.filename.length > 200 || !Number.isInteger(body.sourceBytes) || body.sourceBytes < 1 || body.sourceBytes > MANUAL_SYNC_MAX_BYTES || !(/^[a-f0-9]{64}$/).test(body.sourceSha256) || !MANUAL_SYNC_FAMILIES.some(f => f === body.reportFamily) || !['utf-8', 'windows-1252'].includes(body.encoding ?? 'utf-8'))
                    return reply({ error: 'Invalid source metadata' }, 400);
                const id = crypto.randomUUID(), path = `${tenantId}/${id}/${body.sourceSha256}/original.${body.filename.split('.').pop().toLowerCase()}`;
                const { data: job, error } = await table().insert({ id, tenant_id: tenantId, created_by: user.id, source_filename: body.filename, source_path: path, source_sha256: body.sourceSha256, source_bytes: body.sourceBytes, report_family: body.reportFamily, encoding: body.encoding ?? 'utf-8' }).select(columns).single();
                if (error) {
                    const { data: existing, error: lookupError } = await table().select('*').eq('tenant_id', tenantId).eq('source_sha256', body.sourceSha256).eq('report_family', body.reportFamily).maybeSingle();
                    if (lookupError || !existing)
                        return reply({ error: 'Reservation failed; refresh before retrying.' }, 409);
                    if (existing.encoding !== (body.encoding ?? 'utf-8') || existing.source_bytes !== body.sourceBytes)
                        return reply({ error: 'Existing source metadata differs; operator review required.' }, 409);
                    const safe = Object.fromEntries(columns.split(',').map(k => [k, existing[k]]));
                    if (existing.status === 'uploading') {
                        const { data, error } = await service.storage.from('ideal-import-staging').createSignedUploadUrl(existing.source_path, { upsert: false });
                        if (error || !data)
                            return reply({ job: safe, existing: true, error: 'Existing upload reservation requires operator review.' }, 409);
                        return reply({ job: safe, existing: true, upload: { bucket: 'ideal-import-staging', path: existing.source_path, token: data.token } });
                    }
                    return reply({ job: safe, existing: true });
                }
                const { data: upload, error: uploadError } = await service.storage.from('ideal-import-staging').createSignedUploadUrl(path, { upsert: false });
                if (uploadError || !upload)
                    return reply({ error: 'Upload reservation could not be issued. Job retained; use upload action.', job }, 503);
                return reply({ job, upload: { bucket: 'ideal-import-staging', path, token: upload.token } });
            }
            if (typeof body.jobId !== 'string')
                return reply({ error: 'Job ID required' }, 400);
            const { data: job, error: readError } = await table().select('*').eq('tenant_id', tenantId).eq('id', body.jobId).single();
            if (readError || !job)
                return reply({ error: 'Job unavailable' }, 404);
            if (body.action === 'upload' && job.status === 'uploading') {
                const { data, error } = await service.storage.from('ideal-import-staging').createSignedUploadUrl(job.source_path, { upsert: false });
                if (error || !data)
                    throw error;
                return reply({ upload: { bucket: 'ideal-import-staging', path: job.source_path, token: data.token } });
            }
            if (body.action === 'stage') {
                if (job.status !== 'uploading')
                    return reply({ error: 'Job is already staged; refresh status' }, 409);
                // Stage is only a queue signal. Worker verifies original bytes/hash before review.
                const { data, error } = await table().update({ status: 'staged' }).eq('tenant_id', tenantId).eq('id', job.id).eq('status', 'uploading').select('id');
                if (error || data?.length !== 1)
                    return reply({ error: 'Job state changed; refresh status before retrying.' }, 409);
            }
            else if (body.action === 'approve') {
                const superseded = job.review_summary?.supersededSources ?? [];
                const expectedHashes = superseded.map((source: { sourceSha: string }) => source.sourceSha);
                if (JSON.stringify(body.supersedeSourceHashes ?? []) !== JSON.stringify(expectedHashes))
                    return reply({ error: 'Explicit approval of every replaced source hash is required' }, 409);
                if (job.status !== 'review_required' || !job.plan_sha256 || job.manifest_sha256 !== body.manifestSha256 || job.plan_sha256 !== body.planSha256 || job.approval_sha256 !== body.approvalSha256)
                    return reply({ error: 'Review scope changed or source is review-only' }, 409);
                const { data, error } = await table().update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', job.id).eq('status', 'review_required').eq('approval_sha256', body.approvalSha256).select('id');
                if (error || data?.length !== 1)
                    return reply({ error: 'Approval conflict' }, 409);
            }
            else if (body.action === 'cancel') {
                const { data, error } = await table().update({ status: 'cancelled', lease_until: null }).eq('tenant_id', tenantId).eq('id', job.id).in('status', ['uploading', 'staged', 'preparing', 'review_required', 'quarantined', 'approved', 'applying', 'recovery_required']).select('id');
                if (error || data?.length !== 1)
                    return reply({ error: 'Job cannot be cancelled' }, 409);
            }
            else if (body.action !== 'status')
                return reply({ error: 'Unsupported action' }, 400);
            const { data, error } = await table().select(columns).eq('tenant_id', tenantId).eq('id', job.id).single();
            if (error)
                throw error;
            return reply({ job: data });
        }
        catch {
            return reply({ error: 'Job operation failed; refresh status before retrying.' }, 500);
        }
    };
}
