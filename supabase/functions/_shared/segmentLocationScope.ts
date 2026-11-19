import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Segment store (location) scope, shared by every place that decides whether a customer belongs to a segment.
 * Moved from newsletterAudience.ts (central-login 59, crm-r2-F84) so the membership producers
 * (recompute-segment-memberships, evaluate-segments, evaluate-customer-segments) apply the same rule the
 * newsletter audience already applies: a customer belongs to a store when it is the customer's primary store or the
 * customer has activity there (customer_location_activity). Every query is tenant-scoped, and any lookup error
 * throws so the caller stops instead of widening an audience.
 */

export interface SegmentStoreScopeRow {
  id: string;
  location_scope?: string | null;
  primary_location_id?: string | null;
}

export interface CustomerStoreRow {
  id: string;
  primary_location_id?: string | null;
}

const LOOKUP_CHUNK = 200;
const PAGE_SIZE = 1000;

/**
 * True when the customer (by its store set) is inside the segment's store scope. Applies to every segment, including
 * all-customer and dynamic rules. A scope value other than all_locations, one_location or selected_locations matches
 * nothing; a selected-store segment without a configured target matches nothing.
 */
export function segmentStoreScopeAllows(
  segment: SegmentStoreScopeRow,
  customerLocationIds: ReadonlySet<string>,
  targetLocationsBySegment: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  switch (segment.location_scope) {
    case "all_locations":
      return true;
    case "one_location":
      return typeof segment.primary_location_id === "string" &&
        customerLocationIds.has(segment.primary_location_id);
    case "selected_locations":
      return [...(targetLocationsBySegment.get(segment.id) ?? [])].some((locationId) =>
        customerLocationIds.has(locationId)
      );
    default:
      return false;
  }
}

/** True when at least one segment needs store evidence (anything other than all_locations). */
export function segmentsNeedStoreScope(segments: readonly SegmentStoreScopeRow[]): boolean {
  return segments.some((segment) => segment.location_scope !== "all_locations");
}

/** The configured store targets of the selected-store segments, keyed by segment id (tenant-scoped). */
export async function loadSegmentStoreTargets(
  db: SupabaseClient,
  tenantId: string,
  segments: readonly SegmentStoreScopeRow[],
): Promise<Map<string, Set<string>>> {
  const targets = new Map<string, Set<string>>();
  const selectedIds = segments
    .filter((segment) => segment.location_scope === "selected_locations")
    .map((segment) => segment.id);
  for (let index = 0; index < selectedIds.length; index += LOOKUP_CHUNK) {
    const chunk = selectedIds.slice(index, index + LOOKUP_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("segment_location_targets")
        .select("segment_id, location_id")
        .eq("tenant_id", tenantId)
        .in("segment_id", chunk)
        .order("segment_id")
        .order("location_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Could not load segment store targets: ${error.message}`);
      for (const row of data ?? []) {
        const locations = targets.get(row.segment_id) ?? new Set<string>();
        locations.add(row.location_id);
        targets.set(row.segment_id, locations);
      }
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return targets;
}

/** Each customer's stores: its primary store plus every store in customer_location_activity (tenant-scoped). */
export async function loadCustomerStoreLocations(
  db: SupabaseClient,
  tenantId: string,
  customers: readonly CustomerStoreRow[],
): Promise<Map<string, Set<string>>> {
  const locations = new Map<string, Set<string>>();
  for (const customer of customers) {
    const set = new Set<string>();
    if (typeof customer.primary_location_id === "string") set.add(customer.primary_location_id);
    locations.set(customer.id, set);
  }
  const ids = customers.map((customer) => customer.id);
  for (let index = 0; index < ids.length; index += LOOKUP_CHUNK) {
    const chunk = ids.slice(index, index + LOOKUP_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("customer_location_activity")
        .select("customer_id, location_id")
        .eq("tenant_id", tenantId)
        .in("customer_id", chunk)
        .order("customer_id")
        .order("location_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Could not load customer store activity: ${error.message}`);
      for (const row of data ?? []) locations.get(row.customer_id)?.add(row.location_id);
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return locations;
}

/**
 * The ids of the customers that belong to at least one of the given stores (primary store or activity there).
 * For a send path that must keep an audience inside a campaign's stores (crm-r2-F89). Throws on a lookup error,
 * so the caller can pause instead of sending to a wider audience.
 */
export async function customerIdsInStores(
  db: SupabaseClient,
  tenantId: string,
  customers: readonly CustomerStoreRow[],
  storeIds: Iterable<string>,
): Promise<Set<string>> {
  const stores = new Set(storeIds);
  const inStores = new Set<string>();
  if (stores.size === 0 || customers.length === 0) return inStores;
  const locations = await loadCustomerStoreLocations(db, tenantId, customers);
  for (const [customerId, customerStores] of locations) {
    if ([...customerStores].some((locationId) => stores.has(locationId))) inStores.add(customerId);
  }
  return inStores;
}
