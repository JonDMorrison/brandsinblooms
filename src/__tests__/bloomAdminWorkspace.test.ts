import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveAdminWorkspaceTenant } from "../../supabase/functions/bloom-assist/admin-workspace";
import type { PersistenceClient } from "../../supabase/functions/bloom-assist/types";

const WEST_COAST = "c190325a-5da0-49f6-b374-187464762021";

function client(opts: { isAdmin: unknown; active?: string | null; adminError?: string; contextError?: string }) {
  const calls: { table?: string; filters: [string, unknown][] }[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ table: `rpc:${fn}`, filters: Object.entries(args) });
        return opts.adminError ? { data: null, error: { message: opts.adminError } } : { data: opts.isAdmin, error: null };
      },
      from: (table: string) => {
        const call = { table, filters: [] as [string, unknown][] };
        calls.push(call);
        const q = {
          select: () => q,
          eq: (k: string, v: unknown) => { call.filters.push([k, v]); return q; },
          maybeSingle: async () => opts.contextError
            ? { data: null, error: { message: opts.contextError } }
            : { data: opts.active === undefined ? null : { active_tenant_id: opts.active }, error: null },
        };
        return q;
      },
    } as unknown as Pick<PersistenceClient, "rpc" | "from">,
  };
}

describe("Bloom follows the admin workspace switch", () => {
  it("uses the client company a master admin is working in", async () => {
    const { client: c, calls } = client({ isAdmin: true, active: WEST_COAST });
    await expect(resolveAdminWorkspaceTenant(c, "jon")).resolves.toBe(WEST_COAST);
    expect(calls[1]).toEqual({ table: "admin_session_context", filters: [["admin_user_id", "jon"]] });
  });
  it("leaves regular users on their own company, even with a stray context row", async () => {
    const { client: c, calls } = client({ isAdmin: false, active: WEST_COAST });
    await expect(resolveAdminWorkspaceTenant(c, "bryan")).resolves.toBeNull();
    expect(calls.some((call) => call.table === "admin_session_context")).toBe(false);
  });
  it("keeps a master admin on their own company when no workspace is selected", async () => {
    await expect(resolveAdminWorkspaceTenant(client({ isAdmin: true, active: null }).client, "jon")).resolves.toBeNull();
    await expect(resolveAdminWorkspaceTenant(client({ isAdmin: true }).client, "jon")).resolves.toBeNull();
  });
  it("fails closed when admin status or the workspace cannot be read", async () => {
    await expect(resolveAdminWorkspaceTenant(client({ isAdmin: true, adminError: "boom" }).client, "jon")).rejects.toThrow(/admin access/);
    await expect(resolveAdminWorkspaceTenant(client({ isAdmin: true, contextError: "boom" }).client, "jon")).rejects.toThrow(/admin workspace/);
  });

  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261102140000_bloom_admin_workspace_scope.sql"), "utf8");
  it("only grants the workspace path to master admins with a matching active workspace", () => {
    expect(sql).toMatch(/coalesce\(public\.is_master_admin\(auth\.uid\(\)\), false\)\s+AND EXISTS \(\s+SELECT 1 FROM public\.admin_session_context context\s+WHERE context\.admin_user_id = auth\.uid\(\)\s+AND context\.active_tenant_id = p_tenant_id/);
    expect(sql).toContain("u.id = auth.uid() AND u.tenant_id = p_tenant_id");
  });
  it("keeps personal Bloom rows owned by the signed-in user", () => {
    for (const table of ["bloom_conversations", "bloom_messages", "bloom_user_profiles", "bloom_conversation_exports"])
      for (const cmd of ["select", "insert", "update", "delete"])
        expect(sql).toMatch(new RegExp(`CREATE POLICY ${table}_${cmd}_own[\\s\\S]*?\\(auth\\.uid\\(\\) = user_id\\) AND public\\.bloom_can_access_tenant\\(${table}\\.tenant_id\\)`));
    expect(sql).not.toMatch(/FROM users u\s+WHERE \(\(u\.id = auth\.uid\(\)\)/);
  });
  it("ties Bloom attachments to the stored object path, not users.name", () => {
    const storage = sql.slice(sql.indexOf("bloom_can_access_tenant_folder"));
    expect(storage).not.toMatch(/storage\.foldername\(name\)/);
    expect(storage.match(/storage\.foldername\(objects\.name\)/g)?.length).toBeGreaterThan(10);
    expect(storage).toMatch(/c\.user_id = auth\.uid\(\)/);
    expect(sql).toContain("SET search_path = ''");
  });
  it("lets knowledge search use the same access rule", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION public.match_bloom_knowledge_chunks"));
    expect(fn).toContain("OR public.bloom_can_access_tenant(p_tenant_id)");
    expect(fn).toContain("auth.role() = 'service_role'");
    expect(fn).not.toMatch(/u\.tenant_id = p_tenant_id/);
  });
});
