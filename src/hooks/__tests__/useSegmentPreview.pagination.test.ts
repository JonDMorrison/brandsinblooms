/**
 * Pagination test for the segment preview customer fetch.
 *
 * Pins the fix for Jeff at Brands in Blooms (tenant 0a626809-…, 1,965
 * customers): the live preview was showing 427/573 for two segments
 * whose true membership was 618/1,347 because PostgREST silently caps
 * single requests at `db-max-rows = 1000`. The hook now pages through
 * the customer table in 1,000-row chunks until the page returns short.
 *
 * Test strategy: drive `fetchAllPaginated` directly with a fake
 * `buildPage` that hands out batches; assert the accumulator returns
 * the full set (not a 1,000-row cap) and that the cap triggers
 * `truncated` for tenants beyond the page-limit ceiling.
 */

import { describe, expect, it, vi } from "vitest";

import { fetchAllPaginated } from "@/hooks/useSegmentPreview";

interface Row {
  id: string;
}

function buildFakePager(totalRows: number, pageSize: number) {
  const rows: Row[] = Array.from({ length: totalRows }, (_, idx) => ({
    id: `c-${idx}`,
  }));

  const calls: Array<{ from: number; to: number }> = [];
  const pager = vi.fn((from: number, to: number) => {
    calls.push({ from, to });
    return Promise.resolve({
      data: rows.slice(from, to + 1),
      error: null,
    });
  });

  return { pager, calls, rows, pageSize };
}

describe("fetchAllPaginated", () => {
  it("returns ALL rows for a tenant with 1,965 customers (Jeff's case)", async () => {
    // Jeff at Brands in Blooms: 1,965 active customers.
    // Before this fix the single-shot fetch returned 1,000 unordered rows
    // and the preview showed 427/573 instead of 618/1,347.
    const { pager } = buildFakePager(1965, 1000);

    const { data, truncated } = await fetchAllPaginated<Row>(
      (from, to) => pager(from, to),
      1000,
      50,
    );

    expect(data).toHaveLength(1965);
    expect(truncated).toBe(false);
    // Page 0 = rows 0-999 (1000 rows, full); page 1 = rows 1000-1964
    // (965 rows, short, terminates the loop).
    expect(pager).toHaveBeenCalledTimes(2);
  });

  it("returns ALL rows for a small tenant in one call (early exit on short page)", async () => {
    const { pager } = buildFakePager(42, 1000);

    const { data, truncated } = await fetchAllPaginated<Row>(
      (from, to) => pager(from, to),
      1000,
      50,
    );

    expect(data).toHaveLength(42);
    expect(truncated).toBe(false);
    expect(pager).toHaveBeenCalledTimes(1);
  });

  it("uses .range(from, to) windows that are inclusive on both ends", async () => {
    const { pager, calls } = buildFakePager(1500, 500);

    await fetchAllPaginated<Row>((from, to) => pager(from, to), 500, 50);

    expect(calls).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
      { from: 1000, to: 1499 },
      // Final empty page returns 0 < pageSize, terminating the loop;
      // but since the 3rd batch returned exactly 500 rows we make one
      // more call to check.
      { from: 1500, to: 1999 },
    ]);
  });

  it("caps at maxPages and flags `truncated` for very large tenants", async () => {
    // Simulate Down to Earth Garden Center scale (~107k customers).
    const { pager } = buildFakePager(107_000, 1000);

    const { data, truncated } = await fetchAllPaginated<Row>(
      (from, to) => pager(from, to),
      1000,
      50,
    );

    expect(data).toHaveLength(50_000);
    expect(truncated).toBe(true);
    expect(pager).toHaveBeenCalledTimes(50);
  });

  it("propagates errors from the underlying query", async () => {
    const pager = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      fetchAllPaginated<Row>((from, to) => pager(from, to), 1000, 50),
    ).rejects.toMatchObject({ message: "boom" });
  });

  it("handles a tenant with exactly 1000 customers (the silent-cap boundary)", async () => {
    // Customers at exactly the PostgREST default cap were the latent
    // case before the fix: a single-shot fetch returned all 1000 rows
    // and looked correct, so the bug went unnoticed for ages.
    const { pager } = buildFakePager(1000, 1000);

    const { data, truncated } = await fetchAllPaginated<Row>(
      (from, to) => pager(from, to),
      1000,
      50,
    );

    expect(data).toHaveLength(1000);
    expect(truncated).toBe(false);
    // 1 full page returned exactly pageSize → must make a 2nd call to
    // confirm end-of-table.
    expect(pager).toHaveBeenCalledTimes(2);
  });
});
