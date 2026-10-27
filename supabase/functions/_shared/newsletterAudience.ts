import { createClient } from "npm:@supabase/supabase-js@2.105.1";
import {
  evaluateSegmentRule,
  normalizeSegmentRuleGroup,
} from "./segmentEvaluator.ts";
import type { RenderableContentBlock } from "./campaignEmailContent.ts";
import type { RenderAudience } from "../../../src/lib/studio/newsletter/audience.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requestedNewsletterSegments(
  blocks: RenderableContentBlock[] | null | undefined,
): string[] {
  const ids = new Set<string>();
  for (const raw of blocks || []) {
    const source = raw as Record<string, unknown>;
    const content = (
      source.content && typeof source.content === "object"
        ? source.content
        : source.data && typeof source.data === "object"
          ? source.data
          : source
    ) as Record<string, unknown>;
    const audience = content.audience as
      { mode?: unknown; segmentIds?: unknown } | undefined;
    if (audience?.mode === "segments" && Array.isArray(audience.segmentIds))
      for (const id of audience.segmentIds)
        if (typeof id === "string" && UUID.test(id)) ids.add(id);
  }
  return [...ids].slice(0, 100);
}
/** Resolves only customer/segment rows belonging to the same tenant. Errors stop a
 * conditional send for retry instead of broadening its audience. No browser code
 * imports this service-role module. */
export async function resolveNewsletterAudience(params: {
  tenantId: string;
  customerId?: string;
  blocks?: RenderableContentBlock[] | null;
  preview: boolean;
}): Promise<RenderAudience> {
  if (params.preview && !params.customerId) return { previewAll: true };
  const requested = requestedNewsletterSegments(params.blocks);
  if (
    !requested.length ||
    !params.customerId ||
    !UUID.test(params.customerId) ||
    !UUID.test(params.tenantId)
  )
    return { segmentIds: [] };
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new Error(
      "Conditional newsletter rendering requires a verified audience.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const customerResult = await db
    .from("crm_customers")
    .select("*")
    .eq("id", params.customerId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (customerResult.error)
    throw new Error("Could not verify newsletter recipient account.");
  if (!customerResult.data) return { segmentIds: [] };
  const [segmentsResult, membershipResult] = await Promise.all([
    db
      .from("crm_segments")
      .select(
        "id,conditions,auto_update,include_all_customers,status,deleted_at",
      )
      .eq("tenant_id", params.tenantId)
      .in("id", requested)
      .is("deleted_at", null),
    db
      .from("customer_segments")
      .select("segment_id,crm_segments!inner(tenant_id)")
      .eq("customer_id", params.customerId)
      .eq("crm_segments.tenant_id", params.tenantId),
  ]);
  if (segmentsResult.error || membershipResult.error)
    throw new Error(
      "Could not verify conditional newsletter segment membership.",
    );
  const memberships = new Set(
    (membershipResult.data || []).map((row) => row.segment_id as string),
  );
  const context = {
    customerSegmentsByCustomerId: new Map([[params.customerId, memberships]]),
  };
  const matches = (segmentsResult.data || [])
    .filter((segment) => {
      if (segment.status === "archived" || segment.status === "deleted")
        return false;
      if (segment.include_all_customers === true) return true;
      const rules = normalizeSegmentRuleGroup(segment.conditions);
      if (segment.auto_update === true && rules.children.length)
        return evaluateSegmentRule(rules, customerResult.data, context);
      return memberships.has(segment.id);
    })
    .map((segment) => segment.id as string);
  return { segmentIds: matches };
}
