import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903113000_automation_outbox_recovery.sql",
  "utf8",
);
const worker = readFileSync(
  "supabase/functions/process-automation-outbox/index.ts",
  "utf8",
);
const executor = readFileSync(
  "supabase/functions/automation-executor/index.ts",
  "utf8",
);
const internalAuth = readFileSync(
  "supabase/functions/_shared/requireInternalApiKey.ts",
  "utf8",
);

describe("automation outbox recovery release gate", () => {
  it("expires stale messages and stranded runs without sending them", () => {
    expect(migration).toContain("automation_recovery_batches");
    expect(migration).toContain(
      "Expired: message was more than 24 hours overdue",
    );
    expect(migration).toContain("status = 'failed'");
    expect(worker).toContain("expire_stale_automation_work");
  });

  it("reclaims only recent crashed processing work", () => {
    expect(migration).toContain("o.status = 'processing'");
    expect(migration).toContain("o.locked_until < now()");
    expect(migration).toContain(
      "o.scheduled_at >= now() - interval '24 hours'",
    );
    expect(worker).toContain('.in("status", ["queued", "processing"])');
    expect(worker).toContain('.gte("scheduled_at", messageCutoff)');
  });

  it("does not send work for disabled automations or inactive runs", () => {
    expect(worker).toContain("checkAutomationEligibility");
    expect(worker).toContain(
      "Automation was disabled before this message sent",
    );
    expect(worker).toContain('run.status !== "active"');
  });

  it("keeps recovery and claiming service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.expire_stale_automation_work(timestamptz, integer)",
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.expire_stale_automation_work[\s\S]*TO authenticated/,
    );
  });

  it("authenticates modern secret-key cron calls in each worker", () => {
    expect(worker).toContain("requireInternalApiKey(req)");
    expect(executor).toContain("requireInternalApiKey(req)");
    expect(internalAuth).toContain('req.headers.get("apikey")');
    expect(internalAuth).toContain('Deno.env.get("SUPABASE_SECRET_KEYS")');
    expect(migration).toContain("'apikey', public.get_service_role_key()");
    expect(migration).not.toContain("'Authorization', 'Bearer '");
  });
});
