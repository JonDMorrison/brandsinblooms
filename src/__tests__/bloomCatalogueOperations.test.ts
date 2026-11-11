import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import type { Caller } from "../../supabase/functions/_shared/bloom-support/runtime.ts";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), mutationRpc: vi.fn(), directRpc: vi.fn(), claim: vi.fn(), complete: vi.fn(), reconcile: vi.fn() }));
vi.mock("../../supabase/functions/_shared/bloom-support/runtime.ts", () => ({
  ...mocks,
  BloomError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  claimMcpOperation: mocks.claim, completeMcpOperation: mocks.complete, markOperationReconciliation: mocks.reconcile,
  failOperationUndo: vi.fn(), db: vi.fn(),
  env: (key: string) => key.startsWith("BLOOM_OPS_URL_") ? "https://cms.test/operations" : "test-secret",
}));
vi.mock("../../supabase/functions/bloom-assist/tools/implementations/campaign-mutations.ts", () => ({ campaignMutationImplementation: vi.fn() }));
import { CLIENT_READ_KINDS, describeOperations, executeOperation, previewOperation, runRead } from "../../supabase/functions/_shared/bloom-support/operations.ts";

const site = "10000000-0000-4000-8000-000000000001";
const category = "20000000-0000-4000-8000-000000000001";
const product = "30000000-0000-4000-8000-000000000001";
const actor = { principalId: "staff", role: "support", name: "Sam", via: "api_key", scopes: ["write"] } as Caller;
const inputs = () => ({ category_id: category, product_ids: [product], evidence: { source: "verified SKU export", reason: "Explicit supplier category mapping" } });
const request = () => ({ kind: "site.catalogue.assign_categories", account_id: "account", inputs: inputs() });
const fetcher = vi.fn();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const payload = () => JSON.parse(fetcher.mock.calls.at(-1)![1].body);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetcher);
  mocks.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "has_permission") return true;
    if (fn === "get_account") return { id: "account", links: [{ product: "cms", external_id: site }] };
    if (fn === "finish_operation") return args.outcome;
    return null;
  });
  mocks.mutationRpc.mockImplementation(async (_caller, _fn, args) => args.operation);
  fetcher.mockResolvedValue(reply({ guard: { expected_fingerprint: "reviewed-state" }, counts: { selected: 1 }, products: [{ id: product }] }));
});

describe("Bloom catalogue operations", () => {
  it("discovers staff permissions and advertises no undo", () => {
    const catalogue = describeOperations();
    expect(catalogue.reads).toContainEqual({ kind: "site.catalogue.audit", permission: "ops.site.read" });
    expect(catalogue.changes).toContainEqual({ kind: "site.catalogue.assign_categories", permission: "ops.site.edit", undo: false });
    expect(CLIENT_READ_KINDS.has("site.catalogue.audit")).toBe(false);
    const discovery = readFileSync("supabase/functions/bloom-support-mcp/index.ts", "utf8");
    expect(discovery).toContain("site.catalogue.audit");
    expect(discovery).toContain("site.catalogue.assign_categories");
  });
  it("routes a scoped paginated audit and records the staff read", async () => {
    await runRead(actor, { kind: "site.catalogue.audit", account_id: "account", inputs: { category_id: category, cursor: product, limit: 20 } });
    expect(payload()).toMatchObject({ action: "site.catalogue.audit", site_id: site, inputs: { category_id: category, cursor: product, limit: 20 } });
    expect(mocks.rpc).toHaveBeenCalledWith("log", expect.objectContaining({ action: "operation.read" }));
  });
  it("denies clients and unauthorized staff before contacting CMS", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(runRead({ ...actor, role: "client" }, { kind: "site.catalogue.audit", account_id: "account" })).rejects.toMatchObject({ status: 403 });
    await expect(previewOperation(actor, request())).rejects.toMatchObject({ status: 403 });
    expect(mocks.directRpc).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects cross-account site selection", async () => {
    await expect(previewOperation(actor, { ...request(), inputs: { ...inputs(), site_id: "other-site" } })).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { product_ids: [] }, { product_ids: Array(501).fill(product) }, { product_ids: ["bad-id"] },
    { category_id: "bad-id" }, { evidence: {} }, { evidence: { source: " ", reason: "test" } },
    { evidence: { source: "export", reason: "" } },
  ])("rejects unbounded or unevidenced assignments: %j", async (patch) => {
    await expect(previewOperation(actor, { ...request(), inputs: { ...inputs(), ...patch } })).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.mutationRpc).not.toHaveBeenCalled();
  });
  it("records only the CMS fingerprint and pins the linked site", async () => {
    fetcher.mockResolvedValue(reply({ guard: { expected_fingerprint: "reviewed-state", site_id: "injected-site", product_ids: [] } }));
    const preview = await previewOperation(actor, { ...request(), inputs: { ...inputs(), expected_fingerprint: "caller-value" } });
    expect(payload().inputs).not.toHaveProperty("expected_fingerprint");
    expect(preview.inputs).toEqual({ ...inputs(), site_id: site, expected_fingerprint: "reviewed-state" });
    expect(preview.permission).toBe("ops.site.edit");
  });
  it.each([{}, { guard: [] }, { guard: { expected_fingerprint: " " } }])("refuses a preview without its guard: %j", async (body) => {
    fetcher.mockResolvedValue(reply(body));
    await expect(previewOperation(actor, request())).rejects.toMatchObject({ status: 502 });
    expect(mocks.mutationRpc).not.toHaveBeenCalled();
  });
  it("forwards stored inputs and operation ID, verifies success and never records undo", async () => {
    const preview = await previewOperation(actor, request());
    mocks.claim.mockResolvedValue({ ...preview, id: "operation", status: "executing" });
    fetcher.mockResolvedValue(reply({ result: { added: 1 }, verification: { passed: true }, undo: { unsafe: true } }));
    const result = await executeOperation(actor, "operation");
    expect(payload()).toMatchObject({ action: "site.catalogue.assign_categories", operation_id: "operation", site_id: site, inputs: preview.inputs });
    expect(result).toMatchObject({ status: "succeeded", verification: { passed: true }, undo: null });
  });
  it("does not expand service execution", async () => {
    await expect(executeOperation({ ...actor, role: "service" }, "operation")).rejects.toMatchObject({ status: 403 });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a changed account link before executing the saved preview", async () => {
    const preview = await previewOperation(actor, request());
    mocks.claim.mockResolvedValue({ ...preview, id: "operation", status: "executing" });
    mocks.rpc.mockImplementation(async (fn) => fn === "get_account" ? { id: "account", links: [{ product: "cms", external_id: "new-site" }] } : {});
    fetcher.mockClear();
    await expect(executeOperation(actor, "operation")).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("records an explicit stale-preview rejection without treating it as success", async () => {
    const preview = await previewOperation(actor, request());
    mocks.claim.mockResolvedValue({ ...preview, id: "operation", status: "executing" });
    fetcher.mockResolvedValue(reply({ error: "conflict", message: "Preview changed" }, 409));
    await expect(executeOperation(actor, "operation")).rejects.toMatchObject({ status: 409 });
    expect(mocks.rpc).toHaveBeenCalledWith("finish_operation", expect.objectContaining({ outcome: expect.objectContaining({ status: "failed" }) }));
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("requires reconciliation for an unverified product response", async () => {
    const preview = await previewOperation(actor, request());
    mocks.claim.mockResolvedValue({ ...preview, id: "operation", status: "executing" });
    fetcher.mockResolvedValue(reply({ result: { added: 1 }, verification: { passed: false } }));
    await expect(executeOperation(actor, "operation")).rejects.toMatchObject({ code: "operation_reconciliation_needed" });
    expect(mocks.reconcile).toHaveBeenCalledWith("staff", "operation", "execute");
  });
});
