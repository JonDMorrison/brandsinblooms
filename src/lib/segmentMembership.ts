import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface SegmentMembershipSummary {
  /** Member rows per segment id, counted in the database. */
  segmentCounts: Record<string, number>;
  /** Distinct live customers across all of the tenant's active segments. */
  distinctCustomers: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
}

export function parseSegmentMembershipSummary(raw: Json | null): SegmentMembershipSummary {
  const source = isRecord(raw) ? raw : {};
  const countsSource = isRecord(source.segment_counts) ? source.segment_counts : {};
  const segmentCounts: Record<string, number> = {};
  for (const [segmentId, count] of Object.entries(countsSource)) {
    segmentCounts[segmentId] = toCount(count);
  }
  return {
    segmentCounts,
    distinctCustomers: toCount(source.distinct_customers),
  };
}

/** Counts are computed server-side, so they are not capped at 1,000 rows. */
export async function fetchSegmentMembershipSummary(
  tenantId: string,
): Promise<SegmentMembershipSummary> {
  const { data, error } = await supabase.rpc("segment_membership_summary", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return parseSegmentMembershipSummary(data);
}

interface CopyBatchResult {
  inserted: number;
  lastCustomerId: string | null;
  done: boolean;
}

function parseCopyBatch(raw: Json | null): CopyBatchResult {
  const source = isRecord(raw) ? raw : {};
  return {
    inserted: toCount(source.inserted),
    lastCustomerId:
      typeof source.last_customer_id === "string" ? source.last_customer_id : null,
    done: source.done === true,
  };
}

/**
 * Copy every member of one segment into a new, empty static segment with
 * server-side INSERT ... SELECT batches (10,000 per call). Returns the number
 * of members copied.
 */
export async function copySegmentMembers(
  sourceSegmentId: string,
  targetSegmentId: string,
  options: { batchSize?: number; onProgress?: (copied: number) => void } = {},
): Promise<number> {
  let after: string | null = null;
  let copied = 0;

  // Bounded loop: 1,000 batches of 10,000 covers 10M members.
  for (let batch = 0; batch < 1000; batch += 1) {
    const { data, error } = await supabase.rpc("copy_segment_members_batch", {
      p_source_segment_id: sourceSegmentId,
      p_target_segment_id: targetSegmentId,
      p_after_customer_id: after,
      p_limit: options.batchSize ?? 10_000,
    });
    if (error) throw error;

    const result = parseCopyBatch(data);
    copied += result.inserted;
    options.onProgress?.(copied);

    if (result.done || !result.lastCustomerId) {
      return copied;
    }
    after = result.lastCustomerId;
  }

  throw new Error("Copy stopped before all members were copied.");
}
