import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const bloomAssist = read("supabase/functions/bloom-assist/index.ts");
const watchdogSql = read("supabase/migrations/20261102180000_bloom_watchdog_checks.sql");
const previousWatchdogSource = read("supabase/migrations/20261031140000_bloom_support_operations_hardening.sql");
const deployWorkflow = read(".github/workflows/deploy-edge-functions.yml");

function functionBody(source: string, signature: string) {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("END $$;", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function linesBefore(source: string, index: number, count: number) {
  return source.slice(0, index).split("\n").slice(-count).join("\n");
}

describe("Bloom records requests it refuses before streaming", () => {
  const helperStart = bloomAssist.indexOf("export async function recordRequestRejection(");
  const helper = bloomAssist.slice(helperStart, bloomAssist.indexOf("\nfunction formatSseEvent", helperStart));

  it("writes an 'error' audit row and never throws", () => {
    expect(helperStart).toBeGreaterThan(0);
    expect(helper).toMatch(/logAuditEvent\(\s*serviceClient,\s*context\.tenantId,\s*context\.userId,\s*"error",/);
    expect(helper).toContain("stage: rejection.stage");
    expect(helper).toContain("requested_conversation_id");
    expect(helper).toMatch(/\} catch \(error\) \{\s*console\.error\(/);
    expect(helper).not.toMatch(/throw /);
  });

  it("keeps another tenant's conversation out of this tenant's audit row", () => {
    expect(helper).toMatch(/data\.tenant_id !== context\.tenantId\) \{\s*conversationScope = "other_tenant";/);
  });

  it("calls the helper before every conversation 403", () => {
    const denials = [...bloomAssist.matchAll(/return jsonResponse\(req, \{ error: "Conversation access denied" \}, 403\);/g)];
    expect(denials).toHaveLength(3);
    for (const denial of denials) {
      const before = linesBefore(bloomAssist, denial.index ?? 0, 8);
      expect(before).toContain("await recordRequestRejection(");
      expect(before).toContain('stage: "access_denied"');
      expect(before).toContain("status: 403");
    }
  });

  it("calls the helper before the request-failed 500", () => {
    const failure = bloomAssist.indexOf('return jsonResponse(req, { error: "Internal server error" }, 500);');
    expect(failure).toBeGreaterThan(0);
    const before = linesBefore(bloomAssist, failure, 10);
    expect(before).toContain("await recordRequestRejection(rejectionClient, rejectionContext, {");
    expect(before).toContain('stage: "request_failed"');
    expect(before).toContain("status: 500");
  });

  it("logs the no-tenant 403 without inventing a tenant for the audit row", () => {
    const denial = bloomAssist.indexOf('return jsonResponse(req, { error: "Tenant membership required" }, 403);');
    const before = linesBefore(bloomAssist, denial, 6);
    expect(before).toContain("tenant membership required");
    expect(before).not.toContain("recordRequestRejection");
  });
});

describe("Bloom watchdog checks", () => {
  const previous = functionBody(previousWatchdogSource, "CREATE OR REPLACE FUNCTION bloom_support.watchdog()");
  const next = functionBody(watchdogSql, "CREATE OR REPLACE FUNCTION bloom_support.watchdog()");

  it("keeps every line of the previous watchdog except the three alert lines it extends", () => {
    const nextLines = new Set(next.split("\n"));
    const changed = previous.split("\n").filter((line) => !nextLines.has(line));
    expect(changed).toHaveLength(3);
    expect(changed[0]).toContain("key := (f->>'condition') || ':' || hour;");
    expect(changed[1]).toContain("PERFORM bloom_support.notify_staff(");
    expect(changed[2]).toContain("'Bloom Support watchdog: ' || f::text");
  });

  it("keeps the existing checks and alert delivery", () => {
    for (const condition of ["worker_not_running", "queue_backlog", "dead_jobs", "email_failures"]) {
      expect(next).toContain(`'condition', '${condition}'`);
    }
    expect(next).toContain("PERFORM bloom_support.sweep_deadlines();");
    expect(next).toContain("bloom_support.sweep_operational()");
    expect(next).toContain("ON CONFLICT (dedupe_key) DO NOTHING");
    expect(next).toContain("net.http_post");
    expect(next).toContain("UPDATE bloom_support.alerts SET delivered = 'no_channel'");
  });

  it("leaves existing alert keys, titles and email text unchanged for findings without the new keys", () => {
    expect(next).toContain("coalesce(':' || (f->>'check'), '')");
    expect(next).toContain("CASE WHEN f->>'dedupe_window' = 'day' THEN today ELSE hour END");
    expect(next).toContain("coalesce('Bloom alert: ' || left(f->>'summary', 240), 'Bloom alert: ' || replace(f->>'condition', '_', ' '))");
    expect(next).toContain("'Bloom Support watchdog: ' || coalesce((f->>'summary') || E'\\n\\nDetails: ', '') || f::text");
  });

  it("adds each new check with a plain-language summary", () => {
    for (const condition of [
      "bloom_tool_failures",
      "bloom_tool_timeouts",
      "bloom_request_errors",
      "bloom_negative_feedback",
      "duplicate_system_segments",
      "orphan_segment_memberships",
    ]) {
      const at = next.indexOf(`'condition', '${condition}'`);
      expect(at, condition).toBeGreaterThan(0);
      expect(next.slice(at, at + 600), condition).toContain("'summary'");
    }
  });

  it("uses the thresholds and stored values the request asked for", () => {
    expect(next).toContain("HAVING count(*) >= 5 AND count(*) FILTER (WHERE e.status = 'failed') * 2 >= count(*)");
    expect(next).toContain("coalesce(e.error_message, e.tool_output->>'error') = 'timeout_error'");
    expect(next).toMatch(/a\.event_type = 'error'\s+AND a\.created_at > now\(\) - interval '1 hour'[\s\S]*?HAVING count\(\*\) >= 5/);
    expect(next).toContain("m.metadata->>'feedback' = 'negative'");
    expect(next).toContain("IF total >= 3 THEN");
    expect(next).toMatch(/s\.is_system_segment\s+AND s\.deleted_at IS NULL\s+GROUP BY s\.tenant_id, t\.name, lower\(s\.name\)\s+HAVING count\(\*\) > 1/);
  });

  it("keeps the orphan membership check bounded", () => {
    expect(next).toMatch(/AND EXISTS \(SELECT 1 FROM public\.customer_segments cs WHERE cs\.customer_id = c\.id\)\s+LIMIT 1000/);
    expect(watchdogSql).toContain("WHERE deleted_at IS NOT NULL OR merged_into_customer_id IS NOT NULL;");
  });

  it("isolates each new check so one failure cannot stop the others", () => {
    expect(next.match(/EXCEPTION WHEN OTHERS THEN/g)).toHaveLength(6);
    expect(next.match(/'condition', 'watchdog_check_failed'/g)).toHaveLength(6);
  });

  it("matches the Bloom panel's stored feedback value", () => {
    expect(read("src/hooks/bloom/types.ts")).toContain('export type MessageFeedback = "positive" | "negative" | null;');
  });
});

describe("Edge function deploys use a pinned Supabase CLI", () => {
  it("pins an exact CLI version and still answers the deploy confirmation", () => {
    expect(deployWorkflow).not.toMatch(/version:\s*latest/);
    expect(deployWorkflow).toMatch(/uses: supabase\/setup-cli@v1\s+with:\s+version: \d+\.\d+\.\d+/);
    expect(deployWorkflow).toContain('supabase functions deploy "$fn" --project-ref "$PROJECT_ID" --yes');
  });
});

describe("built-in group cleanup for other companies", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261102200000_builtin_group_dupes_other_tenants.sql"), "utf8");
  it("repoints references before archiving and only soft deletes duplicates", () => {
    expect(sql.indexOf("UPDATE public.crm_campaigns")).toBeLessThan(sql.indexOf("UPDATE public.crm_segments s"));
    expect(sql).toContain("SET deleted_at = now(), status = 'archived'");
    expect(sql).not.toMatch(/DELETE FROM public\.crm_segments/);
    expect(sql).toContain("s.conditions::text LIKE '%' || d.id::text || '%'");
  });
  it("makes the watchdog ignore memberships held only by archived groups", () => {
    expect(sql).toContain("live_s.deleted_at IS NULL");
  });
});
