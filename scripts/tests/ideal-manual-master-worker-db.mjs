// Synthetic localhost-only acceptance of the actual names-only job worker.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hash } from '../prepare-ideal-annual-import.mjs';
import { runManualSyncJob } from '../ideal-manual-sync-job-worker.mjs';
import { localJobClient } from './ideal-job-local-client.mjs';
const schema = 'ideal_master_worker_fixture';
const roles = ['ideal_master_worker_anon', 'ideal_master_worker_auth', 'ideal_master_worker_service'];
const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sql = query => execFileSync('/opt/homebrew/bin/psql', ['-X', '-h', '127.0.0.1', '-p', '55439', '-d', 'ideal_manual_sync_guard_test', '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
assert.equal(sql('SELECT current_database();'), 'ideal_manual_sync_guard_test');
assert.equal(sql(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}';`), '0');
assert.equal(sql(`SELECT count(*) FROM pg_roles WHERE rolname IN (${roles.map(literal).join(',')});`), '0');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ideal-master-worker-'));
let created = false;
try {
  sql(`CREATE SCHEMA ${schema};CREATE ROLE ${roles[0]};CREATE ROLE ${roles[1]};CREATE ROLE ${roles[2]} BYPASSRLS;`);
  created = true;
  sql(`CREATE TABLE ${schema}.tenants(id uuid PRIMARY KEY);INSERT INTO ${schema}.tenants VALUES('${tenant}'),('${other}');
CREATE TABLE ${schema}.crm_customers(id uuid PRIMARY KEY,tenant_id uuid,external_id text,deleted_at timestamptz,merged_into_customer_id uuid,first_name text,last_name text,email text,phone text,ideal_type text,consent boolean,balance numeric,metadata jsonb);
INSERT INTO ${schema}.crm_customers VALUES('${tenant}','${tenant}','0007',NULL,NULL,'Before','Preserve','private@example.invalid','5550000','17',true,123,'{"custom":"keep"}');
CREATE TABLE ${schema}.customer_intelligence_imports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,source text,report_type text,source_filename text,source_sha256 text,source_period_start date,source_period_end date,status text,source_row_count integer,rejected_row_count integer,reconciliation jsonb,created_by uuid,accepted_row_count integer,completed_at timestamptz);
CREATE TABLE ${schema}.customer_intelligence_source_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,customer_id uuid,import_id uuid,source text,event_type text,external_customer_code text,amount numeric,occurred_at timestamptz,source_fingerprint text,raw_data jsonb,UNIQUE(tenant_id,source,source_fingerprint));`);
  sql(`ALTER TABLE ${schema}.crm_customers ADD COLUMN updated_at timestamptz DEFAULT now();CREATE FUNCTION ${schema}.update_crm_customers_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now();RETURN NEW;END;$$;CREATE TRIGGER update_crm_customers_updated_at BEFORE UPDATE ON ${schema}.crm_customers FOR EACH ROW EXECUTE FUNCTION ${schema}.update_crm_customers_updated_at();`);
  for (const file of ['20261022035409_ideal_manual_sync_jobs.sql', '20261022043645_ideal_manual_job_supersession.sql', '20261022060000_ideal_manual_master_updates.sql']) {
    const migration = fs.readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8').split('\n').filter(line => !line.startsWith('INSERT INTO storage.buckets') && !line.startsWith('DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets')).join('\n').replaceAll('public.', `${schema}.`).replaceAll('pg_catalog,public', `pg_catalog,${schema}`).replace(/\banon\b/g, roles[0]).replace(/\bauthenticated\b/g, roles[1]).replace(/\bservice_role\b/g, roles[2]);
    sql(migration);
  }
  const objects = new Map();
  const client = localJobClient(sql, schema, objects);
  let serial = 3;
  function reserve(content, filename = 'master.tsv') {
    const job = `${String(serial++).padStart(8, '0')}-3333-4333-8333-333333333333`;
    const bytes = Buffer.from(content), sha = hash(bytes), sourcePath = `${tenant}/${job}/${sha}/original.tsv`;
    objects.set(sourcePath, bytes);
    sql(`INSERT INTO ${schema}.ideal_manual_sync_jobs(id,tenant_id,created_by,source_filename,source_path,source_sha256,source_bytes,report_family,encoding,status) VALUES('${job}','${tenant}','${tenant}',${literal(filename)},'${sourcePath}','${sha}',${bytes.length},'customer_master','utf-8','staged');`);
    return job;
  }
  const getJob = job => JSON.parse(sql(`SELECT row_to_json(j) FROM ${schema}.ideal_manual_sync_jobs j WHERE id='${job}';`));
  const run = job => runManualSyncJob(client, { tenantId: tenant, jobId: job, workspace });
  const job = reserve('CODE\tFIRSTNAME\tLASTNAME\tEMAIL\tTYPE\n0007\tAfter\t\tignore@example.invalid\t1\n9999\tUnknown\tOwner\t\t\n');
  assert.equal((await run(job)).status, 'review_required');
  const review = getJob(job);
  assert.equal(review.review_summary.acceptedCustomers, 1);
  assert.equal(review.review_summary.sourceCertification.committable, false);
  assert.equal(review.review_summary.sourceCertification.sourceSha256, review.source_sha256);
  assert.equal(review.review_summary.sourceCertification.tenantId, tenant);
  assert.equal(review.review_summary.excludedCustomers, 1);
  assert.deepEqual(review.plan_scope.updateFields, ['first_name', 'last_name']);
  sql(`UPDATE ${schema}.ideal_manual_sync_jobs SET status='approved',approved_at=now(),approved_by='${tenant}' WHERE id='${job}' AND approval_sha256='${review.approval_sha256}';`);
  // Stale names and remapped identity must stop before changing any names.
  sql(`UPDATE ${schema}.crm_customers SET first_name='Concurrent name' WHERE id='${tenant}';`);
  await assert.rejects(() => run(job));
  assert.equal(sql(`SELECT count(*) FROM ${schema}.ideal_manual_sync_receipts;`), '0');
  sql(`UPDATE ${schema}.crm_customers SET first_name='Before',external_id='7' WHERE id='${tenant}';`);
  await assert.rejects(() => run(job));
  sql(`UPDATE ${schema}.crm_customers SET external_id='0007',email='concurrent@example.invalid',ideal_type='19',consent=false,balance=456,metadata='{"custom":"changed"}' WHERE id='${tenant}';`);
  const protectedBefore = sql(`SELECT to_jsonb(c)-'first_name'-'last_name'-'updated_at' FROM ${schema}.crm_customers c WHERE id='${tenant}';`);
  await assert.rejects(() => runManualSyncJob(client, { tenantId: other, jobId: job, workspace }));
  const timestampBefore=sql(`SELECT updated_at::text FROM ${schema}.crm_customers WHERE id='${tenant}';`);
  assert.equal((await run(job)).status, 'completed');
  const timestampAfter=sql(`SELECT updated_at::text FROM ${schema}.crm_customers WHERE id='${tenant}';`);assert.ok(Date.parse(timestampAfter)>Date.parse(timestampBefore));
  assert.equal(sql(`SELECT first_name||'|'||last_name FROM ${schema}.crm_customers WHERE id='${tenant}';`), 'After|Preserve');
  assert.equal(sql(`SELECT to_jsonb(c)-'first_name'-'last_name'-'updated_at' FROM ${schema}.crm_customers c WHERE id='${tenant}';`), protectedBefore);
  assert.equal((await run(job)).status, 'already_completed');
  assert.equal(sql(`SELECT updated_at::text FROM ${schema}.crm_customers WHERE id='${tenant}';`),timestampAfter);
  assert.equal(sql(`SELECT count(*) FROM ${schema}.customer_intelligence_imports;`), '0');
  assert.equal(sql(`SELECT count(*) FROM ${schema}.customer_intelligence_source_events;`), '0');
  assert.equal(sql(`SELECT count(*) FROM ${schema}.crm_customers;`), '1');
  // Renaming the same bytes cannot create another executable job reservation.
  assert.throws(() => reserve('CODE\tFIRSTNAME\tLASTNAME\tEMAIL\tTYPE\n0007\tAfter\t\tignore@example.invalid\t1\n9999\tUnknown\tOwner\t\t\n', 'renamed.tsv'));
  const noop = reserve('CODE\tFIRSTNAME\tLASTNAME\n0007\t\t\n');
  assert.equal((await run(noop)).status, 'review_required');
  assert.equal(getJob(noop).plan_sha256, null);
  assert.equal(getJob(noop).review_summary.unchangedCustomers, 1);
  const empty = reserve('CODE\tFIRSTNAME\tLASTNAME\n');
  assert.equal((await run(empty)).status, 'quarantined');
  assert.equal(getJob(empty).plan_sha256, null);
  assert.equal(sql(`SELECT count(*) FROM ${schema}.ideal_manual_sync_receipts;`), '1');
  console.log(JSON.stringify({ localOnly: true, actualWorkerMasterEndToEnd: true, namesOnly: true, protectedConcurrentEditsPreserved: true, productionTimestampTrigger: true, replayDoesNotTouchTimestamp: true, staleNamesRejected: true, exactCodeAndTenant: true, unknownQuarantined: true, blankNamesPreserved: true, noFactsOrLedger: true, renamedReplayRejected: true, noOpUncommittable: true, emptyQuarantined: true }));
} finally {
  if (created) sql(`DROP SCHEMA ${schema} CASCADE;DROP ROLE ${roles.join(',')};`);
  fs.rmSync(workspace, { recursive: true, force: true });
}
