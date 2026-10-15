import { describe, expect, it, vi } from "vitest";
import {
  getRegisteredTool,
  getToolDefinitions,
} from "../../../../supabase/functions/bloom-assist/tools/registry";
import {
  listLoyaltyProgrammeTemplates,
  listLoyaltyProgrammes,
  readLoyaltyProgrammeResults,
} from "../../../../supabase/functions/bloom-assist/tools/implementations/loyalty-programmes";
import type { ToolExecutionContext } from "../../../../supabase/functions/bloom-assist/tools/types";
function query(data: unknown, count = 1) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "limit"])
    q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error: null, count }));
  q.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error: null, count }).then(resolve);
  return q;
}
function context(builder: ReturnType<typeof query>) {
  return {
    tenantId: "tenant-a",
    authenticatedTenantId: "tenant-a",
    userId: "user-a",
    dataClient: {
      rpc: vi.fn(async () => ({ data: true, error: null })),
      from: vi.fn(() => builder),
    },
    serviceClient: {
      from: vi.fn(() => {
        throw new Error("Privileged reads are forbidden");
      }),
    },
  } as unknown as ToolExecutionContext;
}
describe("Bloom saved loyalty programmes", () => {
  it.each([
    "list_loyalty_programme_templates",
    "list_loyalty_programmes",
    "read_loyalty_programme_results",
  ] as const)("%s is discoverable in normal conversation", (name) => {
    expect(getRegisteredTool(name)?.category).toBe("query");
    expect(
      getToolDefinitions("standard", "admin").some(
        (t) => t.function.name === name,
      ),
    ).toBe(true);
    expect(
      getToolDefinitions("standard", "staff").some(
        (t) => t.function.name === name,
      ),
    ).toBe(true);
  });
  it("lists actual templates without issuing benefits", async () => {
    const c = context(query([]));
    const result = await listLoyaltyProgrammeTemplates({}, c);
    expect(result.success).toBe(true);
    expect(result.count).toBe(11);
    expect(result.confirmation_required).toBe(false);
    expect(c.serviceClient.from).not.toHaveBeenCalled();
  });
  it("uses the authenticated company and displays total count separately from page", async () => {
    const q = query([{ id: "p" }], 75),
      c = context(q);
    const result = await listLoyaltyProgrammes({ page: 2 }, c);
    expect(q.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(q.range).toHaveBeenCalledWith(25, 49);
    expect(result.count).toBe(75);
    expect(c.serviceClient.from).not.toHaveBeenCalled();
  });
  it("preserves unknown customers and exact recorded denominators", async () => {
    const q = query({
      id: "report",
      baseline_id: "baseline",
      result: {
        tenantId: "tenant-a",
        rows: [{ customerId: "a", state: "unknown", growthIndex: null }],
        summary: { originalCohort: 1 },
        limitations: ["Observed changes are not causal lift."],
      },
    });
    const result = await readLoyaltyProgrammeResults(
      { run_id: "10000000-0000-0000-0000-000000000001" },
      context(q),
    );
    expect(result.data).toMatchObject({
      rows: [{ customerId: "a", growthIndex: null }],
      total_count: 1,
      summary: { originalCohort: 1 },
    });
  });
  it("does not accept another company’s returned report", async () => {
    const q = query({ id: "report", result: { tenantId: "other", rows: [] } });
    await expect(
      readLoyaltyProgrammeResults(
        { run_id: "10000000-0000-0000-0000-000000000001" },
        context(q),
      ),
    ).rejects.toThrow("not accessible");
  });
  it("requires one exact reference rather than guessing the last report", async () => {
    await expect(
      readLoyaltyProgrammeResults({}, context(query([]))),
    ).rejects.toThrow("exactly one");
    await expect(
      readLoyaltyProgrammeResults({ run_id: "made up" }, context(query([]))),
    ).rejects.toThrow("exact report ID");
  });
});
