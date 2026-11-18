import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const FIX_MIGRATION = "20261118200000_internal_functions_own_project.sql";
const PRODUCTION_FUNCTIONS_URL = /https:\/\/udldmkqwnxhdeztyqcau\.supabase\.co\/functions\/v1/;

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

describe("database calls to edge functions stay inside their own project", () => {
  it("no migration after the fix hard-codes the production functions URL", () => {
    const later = migrationFiles.filter((name) => name > FIX_MIGRATION);
    const offenders = later.filter((name) =>
      PRODUCTION_FUNCTIONS_URL.test(readFileSync(resolve(migrationsDir, name), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("rewrites cron jobs to resolve this project's URL and only touches the migration role's jobs", () => {
    const migration = readFileSync(resolve(migrationsDir, FIX_MIGRATION), "utf8");
    expect(migration).toContain("'public.internal_function_url(''\\1'')'");
    expect(migration.match(/WHERE username = current_user/g)?.length).toBe(2);
    expect(migration).toContain("PERFORM cron.alter_job(v_job.jobid, command := v_command)");
    expect(migration).toMatch(/RAISE WARNING 'Job % \(id %, owned by %\) still names production/);
  });

  it("builds unsubscribe links and trial reminders from this project's URL", () => {
    const migration = readFileSync(resolve(migrationsDir, FIX_MIGRATION), "utf8");
    const definitions = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.apply_bulk_email_unsubscribe_headers()"));
    expect(definitions).not.toMatch(PRODUCTION_FUNCTIONS_URL);
    expect(definitions).toContain("public.internal_function_url('handle-unsubscribe')");
    expect(definitions.match(/url := public\.internal_function_url\('send-trial-reminder'\)/g)?.length).toBe(2);
  });

  it("keeps the trial reminder function out of the API", () => {
    const migration = readFileSync(resolve(migrationsDir, FIX_MIGRATION), "utf8");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.check_trial_expiration_emails() FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.check_trial_expiration_emails() TO service_role;");
  });
});
