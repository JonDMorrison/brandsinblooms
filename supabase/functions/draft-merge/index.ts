/**
 * Edge Function: draft-merge
 * Performs merge-safe autosave for JSON documents (automation/newsletter).
 * - Input: { doc_type: 'newsletter'|'automation', doc_id: uuid, base_version?: number, new_content: any }
 * - Output: { ok: true, merged_content, version, conflicts?: Array<{ path: string, base: any, local: any, remote: any }> }
 *
 * Notes:
 * - Uses append-only versioning in public.draft_snapshots
 * - Enforces tenant scoping: we derive tenant_id from the current user
 * - Simple 3-way merge strategy with conflict detection per key path
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DocType = "newsletter" | "automation";

type SnapshotRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  doc_type: DocType;
  doc_id: string;
  version: number;
  content: Record<string, unknown> | null;
  conflict_diff?: unknown;
  created_at: string;
  updated_at: string;
};

type MergeResult = {
  merged: any;
  conflicts: Array<{ path: string; base: any, local: any; remote: any }>;
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const body = await req.json();
    const doc_type: DocType = body?.doc_type;
    const doc_id: string = body?.doc_id;
    const base_version: number | null = body?.base_version ?? null;
    const new_content: any = body?.new_content;

    if (!doc_type || !doc_id || new_content === undefined) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Get user and tenant
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const { data: tenantRow, error: tenantErr } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (tenantErr || !tenantRow?.tenant_id) {
      return new Response(JSON.stringify({ ok: false, error: "No tenant found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = tenantRow.tenant_id as string;

    // 2) Load head snapshot (latest)
    const { data: head, error: headErr } = await supabase
      .from("draft_snapshots")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("doc_type", doc_type)
      .eq("doc_id", doc_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<SnapshotRow>();

    if (headErr) {
      console.log("Head load error:", headErr);
    }

    const currentVersion = head?.version ?? 0;

    // Helper: Load base snapshot content for the provided base_version
    const loadBaseContent = async (version: number): Promise<any> => {
      if (!version || version <= 0) return {};
      const { data: baseRow } = await supabase
        .from("draft_snapshots")
        .select("content")
        .eq("tenant_id", tenantId)
        .eq("doc_type", doc_type)
        .eq("doc_id", doc_id)
        .eq("version", version)
        .maybeSingle<{ content: any }>();
      return baseRow?.content ?? {};
    };

    let mergedContent = new_content;
    let conflicts: MergeResult["conflicts"] = [];

    if (currentVersion === 0) {
      // First snapshot for this doc — accept content as-is with version 1
      // No conflicts possible
    } else if (base_version === null || base_version === undefined || base_version === currentVersion) {
      // Simple fast-forward overwrite: user edited from head version, no merge needed
    } else {
      // 3) 3-way merge (base vs local vs head)
      const baseContent = await loadBaseContent(base_version!);
      const remoteContent = head?.content ?? {};
      const mergeResult = threeWayMerge(baseContent, new_content, remoteContent);
      mergedContent = mergeResult.merged;
      conflicts = mergeResult.conflicts;
    }

    // 4) Write new version (append-only)
    const newVersion = currentVersion + 1;
    const insertPayload: Partial<SnapshotRow> = {
      user_id: userId,
      tenant_id: tenantId,
      doc_type,
      doc_id,
      version: newVersion,
      content: mergedContent,
      conflict_diff: conflicts.length ? { conflicts } : null,
    };

    const { error: insertErr } = await supabase.from("draft_snapshots").insert(insertPayload as any);
    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ ok: false, error: "Failed to write snapshot" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Respond
    return new Response(
      JSON.stringify({
        ok: true,
        merged_content: mergedContent,
        version: newVersion,
        conflicts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("draft-merge error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Simple 3-way merge:
 * - If only local changed => take local
 * - If only remote changed => take remote
 * - If both changed:
 *    - If both objects => recurse
 *    - Else => conflict, prefer local but record it
 */
function threeWayMerge(base: any, local: any, remote: any, path: string = ""): MergeResult {
  // Primitives equality
  if (!isObject(base) && !isObject(local) && !isObject(remote)) {
    if (equals(local, remote)) {
      return { merged: local, conflicts: [] };
    }
    // Only local changed
    if (equals(base, remote) && !equals(base, local)) {
      return { merged: local, conflicts: [] };
    }
    // Only remote changed
    if (equals(base, local) && !equals(base, remote)) {
      return { merged: remote, conflicts: [] };
    }
    // Both changed differently => conflict
    return {
      merged: local,
      conflicts: [{ path, base, local, remote }],
    };
  }

  // If one side is not object, normalize to primitive comparison
  if (!isObject(base) || !isObject(local) || !isObject(remote)) {
    // Only local changed
    if (equals(base, remote) && !equals(base, local)) {
      return { merged: local, conflicts: [] };
    }
    // Only remote changed
    if (equals(base, local) && !equals(base, remote)) {
      return { merged: remote, conflicts: [] };
    }
    // Both changed differently => conflict
    return {
      merged: local,
      conflicts: [{ path, base, local, remote }],
    };
  }

  // All objects: merge keys
  const keys = new Set<string>([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {}),
  ]);
  const merged: Record<string, any> = {};
  let conflicts: MergeResult["conflicts"] = [];

  for (const key of keys) {
    const subPath = path ? `${path}.${key}` : key;
    const b = base?.[key];
    const l = local?.[key];
    const r = remote?.[key];

    // If equal on both sides, keep either
    if (equals(l, r)) {
      merged[key] = l;
      continue;
    }

    // Only local changed
    if (equals(b, r) && !equals(b, l)) {
      merged[key] = l;
      continue;
    }

    // Only remote changed
    if (equals(b, l) && !equals(b, r)) {
      merged[key] = r;
      continue;
    }

    // Both changed
    const res = threeWayMerge(b, l, r, subPath);
    merged[key] = res.merged;
    if (res.conflicts.length) conflicts = conflicts.concat(res.conflicts);
  }

  return { merged, conflicts };
}

function isObject(v: any): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function equals(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}
