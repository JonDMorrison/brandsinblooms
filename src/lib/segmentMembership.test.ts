import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import {
  copySegmentMembers,
  fetchSegmentMembershipSummary,
  parseSegmentMembershipSummary,
} from "./segmentMembership";
import { fetchAllPaginated } from "@/hooks/useSegmentPreview";

// West Coast Gardens "Lapsed Customers" in production: 23,648 members.
const LAPSED_MEMBERS = 23_648;

describe("segment counts above 1,000", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("uses database counts, not a row download", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        segment_counts: { lapsed: LAPSED_MEMBERS, frequent: 20_820 },
        distinct_customers: 33_500,
      },
      error: null,
    });

    const summary = await fetchSegmentMembershipSummary("tenant-1");

    expect(rpc).toHaveBeenCalledWith("segment_membership_summary", {
      p_tenant_id: "tenant-1",
    });
    expect(summary.segmentCounts.lapsed).toBe(LAPSED_MEMBERS);
    // Customers reached is a distinct count, not the sum of memberships.
    expect(summary.distinctCustomers).toBe(33_500);
  });

  it("tolerates malformed payloads", () => {
    expect(parseSegmentMembershipSummary(null)).toEqual({
      segmentCounts: {},
      distinctCustomers: 0,
    });
    expect(
      parseSegmentMembershipSummary({ segment_counts: { a: "12" }, distinct_customers: -3 }),
    ).toEqual({ segmentCounts: { a: 12 }, distinctCustomers: 0 });
  });

  it("copies every member with server-side batches", async () => {
    let remaining = LAPSED_MEMBERS;
    let batchIndex = 0;
    rpc.mockImplementation(async (_fn: string, args: { p_limit: number }) => {
      const inserted = Math.min(args.p_limit, remaining);
      remaining -= inserted;
      batchIndex += 1;
      return {
        data: {
          inserted,
          last_customer_id: `cursor-${batchIndex}`,
          done: inserted < args.p_limit,
        },
        error: null,
      };
    });

    const copied = await copySegmentMembers("source", "target");

    expect(copied).toBe(LAPSED_MEMBERS);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_after_customer_id: null });
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_after_customer_id: "cursor-1" });
  });

  it("surfaces a failed batch instead of reporting a partial copy", async () => {
    rpc.mockResolvedValueOnce({
      data: { inserted: 10_000, last_customer_id: "c", done: false },
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });

    await expect(copySegmentMembers("source", "target")).rejects.toMatchObject({
      message: "timeout",
    });
  });

  it("export paging walks past 1,000 rows", async () => {
    const pages: Array<[number, number]> = [];
    const { data, truncated } = await fetchAllPaginated<{ id: number }>(
      async (from, to) => {
        pages.push([from, to]);
        const end = Math.min(to, LAPSED_MEMBERS - 1);
        const rows = [];
        for (let id = from; id <= end; id += 1) rows.push({ id });
        return { data: rows, error: null };
      },
      1000,
      1000,
    );

    expect(truncated).toBe(false);
    expect(data).toHaveLength(LAPSED_MEMBERS);
    expect(pages).toHaveLength(24);
  });
});
