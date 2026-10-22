/** Operator invoked, never a daemon. Existing service credentials stay in env.
 * No SQL is read or executed. Only reviewed structured payload RPCs are used. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { prepareManualSync, hashFile } from './ideal-manual-sync.mjs';
import { prepareAnnualPlan } from './ideal-manual-sync-plan.mjs';
import { planImport, hash } from './prepare-ideal-annual-import.mjs';
async function checked(query) { const { data, error } = await query; if (error)
    throw Error('Scoped job operation failed'); return data; }
export async function pages(client, table, columns, tenant, configure = q => q) { const out = []; let expected = null; for (let start = 0;; start += 500) {
    const { data, error, count } = await configure(client.from(table).select(columns, { count: 'exact' }).eq('tenant_id', tenant)).order('id').range(start, start + 499);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0 || count > 250000 || expected !== null && expected !== count)
        throw Error('Identity/inventory snapshot incomplete or changed');
    expected = count;
    if (data.length !== Math.min(500, Math.max(0, count - start)))
        throw Error('Identity/inventory page truncated');
    out.push(...data);
    if (out.length === count)
        return out;
} }
export function validateJobSource(job) {
    if (typeof job.source_filename !== 'string' || !/^([^/\\\x00-\x1f]+)\.(xls|xlsx|csv|txt|tsv)$/i.test(job.source_filename) || job.source_filename.length > 200 || !(/^[a-f0-9]{64}$/).test(job.source_sha256) || !Number.isInteger(job.source_bytes) || job.source_bytes < 1 || job.source_bytes > 128 * 1024 * 1024)
        throw Error('Invalid reserved original metadata');
    const expected = `${job.tenant_id}/${job.id}/${job.source_sha256}/original.${job.source_filename.split('.').pop().toLowerCase()}`;
    if (job.source_path !== expected)
        throw Error('Original object path differs from job scope');
}
export async function runManualSyncJob(client, { tenantId, jobId, workspace }) {
    if (!/^[a-f0-9-]{36}$/i.test(tenantId) || !(/^[a-f0-9-]{36}$/i.test(jobId)))
        throw Error('Explicit tenant and job UUID required');
    const before = await checked(client.from('ideal_manual_sync_jobs').select('*').eq('tenant_id', tenantId).eq('id', jobId).single());
    if (before.status === 'completed')
        return { status: 'already_completed', notice: 'No facts replayed. Derived metric/source health readiness is separate.' };
    const job = await checked(client.rpc('claim_ideal_manual_job', { p_tenant: tenantId, p_job: jobId }));
    let heartbeatFailure = false, heartbeat = Promise.resolve();
    const timer = setInterval(() => { heartbeat = heartbeat.then(async () => { try {
        if (!await checked(client.rpc('heartbeat_ideal_manual_job', { p_tenant: tenantId, p_job: jobId, p_lease: job.lease_token, p_generation: job.lease_generation })))
            heartbeatFailure = true;
    }
    catch {
        heartbeatFailure = true;
    } }); }, 30000);
    const ownedUpdate = value => client.from('ideal_manual_sync_jobs').update(value).eq('tenant_id', tenantId).eq('id', jobId).eq('lease_token', job.lease_token).eq('lease_generation', job.lease_generation).in('status', ['preparing', 'applying']).gt('lease_until', new Date().toISOString()).select('id');
    try {
        if (job.manifest_sha256) {
            if (!job.approved_at)
                throw Error('Exact review approval missing');
            // Claim FOR UPDATE waits for previous transactions, fencing old lease owners.
            // RPC verifies every existing receipt+fact before treating it as committed.
            for (let i = 0; i < job.batch_count; i++)
                await checked(client.rpc('apply_ideal_manual_batch', { p_tenant: tenantId, p_job: jobId, p_plan: job.plan_sha256, p_approval: job.approval_sha256, p_lease: job.lease_token, p_generation: job.lease_generation, p_index: i }));
            await checked(client.rpc('finish_ideal_manual_job', { p_tenant: tenantId, p_job: jobId, p_plan: job.plan_sha256, p_lease: job.lease_token, p_generation: job.lease_generation }));
            return { status: 'completed', notice: 'Source facts complete. Derived metric/source health readiness is separate; no campaign or coupon trigger was run.' };
        }
        validateJobSource(job);
        fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
        const run = fs.mkdtempSync(path.join(workspace, 'ideal-job-'));
        fs.chmodSync(run, 0o700);
        const original = path.join(run, job.source_filename), bundle = path.join(run, 'bundle');
        const blob = await checked(client.storage.from('ideal-import-staging').download(job.source_path));
        if (blob.size !== job.source_bytes)
            throw Error('Original size differs');
        // Original <=128MiB; decoded workbook remains in bounded child process.
        fs.writeFileSync(original, Buffer.from(await blob.arrayBuffer()), { mode: 0o600 });
        if (await hashFile(original) !== job.source_sha256)
            throw Error('Original digest differs');
        const manifest = await prepareManualSync({ source: original, out: bundle, reportFamily: job.report_family, tenantId, encoding: job.encoding });
        if (heartbeatFailure)
            throw Error('Preparation heartbeat failed; inspect lease before retry');
        const summary = { sourceRows: manifest.counts.sourceRows, normalizedRows: manifest.counts.normalizedRows, acceptedCustomers: 0, acceptedItems: 0, amountCents: 0, excludedCustomers: 0, excludedItems: 0, failures: manifest.reconciliation.failures, notices: ['Preparation is not approval. Local dates and unverified ownership remain evidence only.', 'Fact completion does not certify derived metric projection or source health.', 'Overlapping cumulative reports require the separately reviewed CLI supersession workflow; this job cannot replace prior snapshots.'], periodStart: manifest.periodStart ?? null, periodEnd: manifest.periodEnd ?? null };
        let plan = null, identitySha = null;
        if (['annual_sales', 'customer_sales'].includes(job.report_family) && manifest.status === 'review_required') {
            const customers = await pages(client, 'crm_customers', 'id,external_id', tenantId, q => q.is('deleted_at', null).is('merged_into_customer_id', null));
            const identities = { tenantId, customers: customers.map(c => ({ id: c.id, code: c.external_id })).filter(c => typeof c.code === 'string') };
            identitySha = hash(JSON.stringify(identities));
            const inventory = await pages(client, 'customer_intelligence_imports', 'id,source_sha256,source_period_start,source_period_end,status,report_type', tenantId, q => q.eq('source', 'ideal').eq('report_type', 'customer_sales_summary'));
            const priorSources = inventory.map(i => ({ tenantId, source: { sha256: i.source_sha256 }, periodStart: i.source_period_start, periodEnd: i.source_period_end, status: i.status, reportFamily: 'annual_sales' }));
            const validation = await prepareAnnualPlan({ bundle, original, identities, priorSources, out: path.join(run, 'validation-plan') });
            if (validation.status !== 'approval_required')
                throw Error('Existing source requires reconciliation');
            // Reuse the validated exact bundle to obtain structured events; SQL artifacts
            // produced by the legacy validator are never read or executed.
            const groups = [];
            let group = null, offset = 0;
            const offsets = new Map();
            for (const s of manifest.sheets) {
                offsets.set(s.name, offset);
                offset += s.sourceRows;
            }
            for (const chunk of manifest.chunks)
                for (const line of fs.readFileSync(path.join(bundle, chunk.path), 'utf8').trim().split('\n')) {
                    const r = JSON.parse(line), f = r.fields;
                    if (group?.code !== r.customerCode) {
                        group = { code: r.customerCode, items: [], cents: 0, quantity: 0, start: { sheet: r.source.sheet, row: r.source.row } };
                        groups.push(group);
                    }
                    group.items.push([f.productCode, f.productName, f.department, f.quantity, f.amountCents / 100, offsets.get(r.source.sheet) + r.source.row]);
                    group.cents += f.amountCents;
                    group.quantity += f.quantity;
                }
            const ids = Object.fromEntries(identities.customers.map(c => [c.code, c.id]));
            const quarantineIndexes = groups.flatMap((g, i) => ids[g.code] ? [] : [i + 1]);
            plan = planImport({ tenantId, sourceSha: job.source_sha256, filename: job.source_filename, start: manifest.periodStart, end: manifest.periodEnd, groups, quarantineIndexes, sourceRows: manifest.counts.sourceRows, expectedCustomerIds: ids, supersededSources: [] });
            if (plan.planSha !== validation.planSha256)
                throw Error('Structured plan differs from validated plan');
            Object.assign(summary, { acceptedCustomers: plan.totals.groups, acceptedItems: plan.totals.items, amountCents: plan.totals.cents, excludedCustomers: plan.totals.quarantinedGroups, excludedItems: plan.totals.quarantinedItems });
            if (!plan.events.length)
                throw Error('No approved identities');
            for (let start = 0; start < plan.events.length; start += 500) {
                const payload = plan.events.slice(start, start + 500), index = start / 500, payloadSha = hash(JSON.stringify(payload));
                await checked(client.rpc('stage_ideal_manual_batch', { p_tenant: tenantId, p_job: jobId, p_lease: job.lease_token, p_generation: job.lease_generation, p_index: index, p_hash: payloadSha, p_payload: payload }));
            }
        }
        const prefix = job.source_path.slice(0, job.source_path.lastIndexOf('/'));
        for (const name of ['manifest.json', ...manifest.chunks.map(c => c.path)]) {
            const bytes = fs.readFileSync(path.join(bundle, name));
            const destination = `${prefix}/prepared/${manifest.manifestSha256}/${name}`;
            const { error } = await client.storage.from('ideal-import-staging').upload(destination, bytes, { upsert: false, contentType: 'application/octet-stream' });
            if (error) {
                const prior = await checked(client.storage.from('ideal-import-staging').download(destination));
                if (hash(Buffer.from(await prior.arrayBuffer())) !== hash(bytes))
                    throw Error('Prepared object conflict');
            }
        }
        const scope = plan ? { periodStart: manifest.periodStart, periodEnd: manifest.periodEnd, sourceSha256: job.source_sha256, manifestSha256: manifest.manifestSha256, planSha256: plan.planSha, identitySha256: identitySha, totals: plan.totals } : null;
        const updated = await checked(ownedUpdate({ manifest_sha256: manifest.manifestSha256, plan_sha256: plan?.planSha ?? null, identity_sha256: identitySha, approval_sha256: scope ? hash(JSON.stringify(scope)) : null, plan_scope: scope, review_summary: summary, batch_count: plan ? Math.ceil(plan.events.length / 500) : 0, status: manifest.status === 'quarantined' ? 'quarantined' : 'review_required', lease_until: null, last_error: null }));
        if (updated.length !== 1)
            throw Error('Lease lost or cancelled');
        return { status: manifest.status, normalizedRows: manifest.counts.normalizedRows };
    }
    catch (error) {
        await ownedUpdate({ status: 'recovery_required', last_error: 'Operator reconciliation required; inspect private diagnostics and authoritative receipts before retry.', lease_until: null });
        throw error;
    }
    finally {
        clearInterval(timer);
        await heartbeat;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [tenantId, jobId, workspace] = process.argv.slice(2);
    if (!workspace)
        throw Error('Usage: tenant-uuid job-uuid private-work-directory');
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
        throw Error('Existing operator environment required; no credentials are created');
    const client = createClient(url, key, { auth: { persistSession: false } });
    console.log(JSON.stringify(await runManualSyncJob(client, { tenantId, jobId, workspace })));
}
