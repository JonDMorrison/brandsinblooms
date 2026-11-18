import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

/** The most recent migration that (re)defines invoke_internal_notion_sync. */
function latestNotionSyncDefinition() {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const definingFiles = files.filter((name) =>
    readFileSync(resolve(migrationsDir, name), "utf8").includes(
      "CREATE OR REPLACE FUNCTION public.invoke_internal_notion_sync()",
    ),
  );
  const latest = definingFiles.at(-1);
  if (!latest) throw new Error("invoke_internal_notion_sync is not defined in any migration");
  const source = readFileSync(resolve(migrationsDir, latest), "utf8");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public.invoke_internal_notion_sync()");
  const end = source.indexOf("$$;", start);
  return { file: latest, body: source.slice(start, end) };
}

describe("internal Notion sync destination", () => {
  it("never hard-codes a project URL in the live trigger function", () => {
    const { file, body } = latestNotionSyncDefinition();
    expect(file).toBe("20261118190000_internal_notion_sync_own_project.sql");
    expect(body).not.toMatch(/https:\/\/[a-z0-9]{20}\.supabase\.co/);
    expect(body).toContain("public.internal_functions_base_url()");
    expect(body).toContain("v_base_url || '/functions/v1/' || v_function_slug");
  });

  it("skips the post when this project's base URL is not configured", () => {
    const { body } = latestNotionSyncDefinition();
    expect(body).toMatch(/IF v_base_url IS NULL THEN[\s\S]*?RETURN NEW;/);
  });

  it("reads the base URL only from Vault, accepts only a Supabase origin, and hides it from the API", () => {
    const migration = readFileSync(
      resolve(migrationsDir, "20261118190000_internal_notion_sync_own_project.sql"),
      "utf8",
    );
    expect(migration).toContain("FROM vault.decrypted_secrets s");
    expect(migration).toContain("WHERE s.name = 'internal_functions_base_url'");
    expect(migration).toContain("'^https://[a-z0-9]{20}\\.supabase\\.co$'");
    expect(migration).not.toMatch(/vault\.create_secret\(\s*'https/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.internal_functions_base_url\(\)\s+FROM PUBLIC, anon, authenticated/,
    );
  });
});
