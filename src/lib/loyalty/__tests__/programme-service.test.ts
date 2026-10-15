import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProgrammeHandler,
  executeProgrammeCommand,
  type ProgrammeContext,
} from "../../../../supabase/functions/_shared/loyalty/programme-service";
import { createProgrammeDraft } from "../../../../supabase/functions/_shared/loyalty/programme-templates";
import { calendarWorkbookRows } from "../calendarWorkbook";
import type { WorkbookSource } from "../calendarWorkbook";
import { programmeFormFromDraft, parseProgrammeForm } from "../programmeForm";
import { programmeResultCsv } from "../programmeApi";
import type { ProgrammeResult } from "../../../../supabase/functions/_shared/loyalty/programme-measurement";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));
afterAll(() => vi.unstubAllGlobals());
const tenantId = "10000000-0000-0000-0000-000000000001",
  userId = "10000000-0000-0000-0000-000000000011";
const bearer = "Bearer " + "synthetic-fixture-token-not-a-credential".repeat(2);
const now = new Date("2026-10-15T18:00:00Z");
function builder(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "is",
    "lte",
    "order",
    "range",
    "limit",
    "not",
    "neq",
    "in",
  ])
    query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query;
}
function setup(
  options: {
    role?: string;
    permissions?: string[];
    userError?: boolean;
    company?: string;
  } = {},
) {
  const list = builder({
    data: [{ id: "p", name: "Garden programme" }],
    error: null,
    count: 1,
  });
  const userClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.userError ? null : { id: userId } },
        error: options.userError ? new Error("invalid") : null,
      })),
    },
    rpc: vi.fn(async () => ({
      data: {
        tenantId: options.company ?? tenantId,
        role: options.role ?? "owner_admin",
        permissions: options.permissions ?? [
          "customers.read",
          "reports.read",
          "loyalty.write",
        ],
      },
      error: null,
    })),
    from: vi.fn(() => list),
  };
  const service = {
    rpc: vi.fn(async () => ({
      data: { programmeId: "saved", versionId: "version" },
      error: null,
    })),
    from: vi.fn(),
  };
  const serviceFactory = vi.fn(() => service as unknown as SupabaseClient),
    userFactory = vi.fn(() => userClient as unknown as SupabaseClient);
  const handler = createProgrammeHandler({
    userClient: userFactory,
    serviceClient: serviceFactory,
    now: () => now,
  });
  const request = (
    body: unknown,
    authorization: string | null = bearer,
    method = "POST",
  ) =>
    new Request("https://fixture.example.test/loyalty-programmes", {
      method,
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  return {
    handler,
    request,
    userClient,
    service,
    serviceFactory,
    userFactory,
    list,
  };
}
describe("authenticated programme HTTP boundary", () => {
  it("requires a session before constructing either data client", async () => {
    const x = setup();
    expect((await x.handler(x.request({}, null))).status).toBe(401);
    expect(x.userFactory).not.toHaveBeenCalled();
    expect(x.serviceFactory).not.toHaveBeenCalled();
  });
  it("checks getUser, not user-controlled metadata, before privileged work", async () => {
    const x = setup({ userError: true });
    expect(
      (
        await x.handler(
          x.request({ action: "list", expectedTenantId: tenantId }),
        )
      ).status,
    ).toBe(401);
    expect(x.serviceFactory).not.toHaveBeenCalled();
  });
  it.each(["staff", "store_manager", "unknown"])(
    "does not give company-wide cohorts to %s",
    async (role) => {
      const x = setup({ role });
      expect(
        (
          await x.handler(
            x.request({ action: "list", expectedTenantId: tenantId }),
          )
        ).status,
      ).toBe(403);
      expect(x.serviceFactory).not.toHaveBeenCalled();
    },
  );
  it("fails closed when a reporting permission is absent", async () => {
    const x = setup({ permissions: ["customers.read", "loyalty.write"] });
    expect(
      (
        await x.handler(
          x.request({ action: "list", expectedTenantId: tenantId }),
        )
      ).status,
    ).toBe(403);
    expect(x.serviceFactory).not.toHaveBeenCalled();
  });
  it("uses the verified current tenant and rejects a stale company selection", async () => {
    const x = setup();
    const out = await x.handler(
      x.request({
        action: "list",
        expectedTenantId: "20000000-0000-0000-0000-000000000001",
      }),
    );
    expect(out.status).toBe(409);
    expect(x.userClient.from).not.toHaveBeenCalled();
  });
  it("reads lists through the authenticated client with explicit tenant and page", async () => {
    const x = setup({ role: "marketing" });
    const out = await x.handler(
      x.request({ action: "list", expectedTenantId: tenantId, page: 2 }),
    );
    expect(out.status).toBe(200);
    expect(x.list.eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(x.list.range).toHaveBeenCalledWith(50, 99);
    expect(x.service.from).not.toHaveBeenCalled();
    expect(out.headers.get("Cache-Control")).toBe("no-store");
  });
  it("never accepts a caller user or role override", async () => {
    const x = setup();
    const out = await x.handler(
      x.request({
        action: "list",
        expectedTenantId: tenantId,
        userId: "somebody",
        role: "owner_admin",
      }),
    );
    expect(out.status).toBe(400);
    expect(x.service.rpc).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before a baseline commit", async () => {
    const x = setup();
    const out = await x.handler(
      x.request({
        action: "confirm_baseline",
        expectedTenantId: tenantId,
        previewId: "20000000-0000-0000-0000-000000000001",
        digest: "a".repeat(64),
        confirmed: false,
      }),
    );
    expect(out.status).toBe(400);
    expect(x.service.rpc).not.toHaveBeenCalled();
  });
  it("binds a confirmed operation to the authenticated actor and exact digest", async () => {
    const x = setup();
    await x.handler(
      x.request({
        action: "confirm_baseline",
        expectedTenantId: tenantId,
        previewId: "20000000-0000-0000-0000-000000000001",
        digest: "a".repeat(64),
        confirmed: true,
      }),
    );
    expect(x.service.rpc).toHaveBeenCalledWith("confirm_loyalty_baseline_v1", {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_preview_id: "20000000-0000-0000-0000-000000000001",
      p_digest: "a".repeat(64),
    });
  });
  it("parses the complete existing programme rules before persisting a draft", async () => {
    const x = setup(),
      draft = createProgrammeDraft(
        "welcome",
        "CAD",
        "2026-10-15",
        "America/Vancouver",
      );
    const key = "30000000-0000-0000-0000-000000000001";
    const out = await x.handler(
      x.request({
        action: "save_draft",
        expectedTenantId: tenantId,
        definition: draft,
        requestKey: key,
      }),
    );
    expect(out.status).toBe(200);
    expect(x.service.rpc).toHaveBeenCalledWith(
      "save_loyalty_programme_v1",
      expect.objectContaining({
        p_user_id: userId,
        p_request_key: key,
        p_definition: draft,
      }),
    );
  });
  it("rejects malformed rules and does not change balances or consent", async () => {
    const x = setup();
    const out = await x.handler(
      x.request({
        action: "save_draft",
        expectedTenantId: tenantId,
        definition: { version: 1, name: "invented", currency: "CAD" },
        requestKey: "30000000-0000-0000-0000-000000000001",
      }),
    );
    expect(out.status).toBe(400);
    expect(x.service.rpc).not.toHaveBeenCalled();
    expect(x.service.from).not.toHaveBeenCalled();
  });
  it("honors methods and handles malformed JSON without effects", async () => {
    const x = setup();
    expect((await x.handler(x.request({}, bearer, "GET"))).status).toBe(405);
    expect((await x.handler(x.request({}, bearer, "OPTIONS"))).status).toBe(
      204,
    );
    const bad = new Request("https://fixture.example.test", {
      method: "POST",
      headers: { Authorization: bearer },
      body: "{",
    });
    expect((await x.handler(bad)).status).toBe(400);
    expect(x.serviceFactory).not.toHaveBeenCalled();
  });
  it("enforces the bounded request size while streaming", async () => {
    const x = setup();
    const huge = new Request("https://fixture.example.test", {
      method: "POST",
      headers: { Authorization: bearer },
      body: "a".repeat(2_200_001),
    });
    expect((await x.handler(huge)).status).toBe(413);
    expect(x.serviceFactory).not.toHaveBeenCalled();
  });
  it("does not accept zero/negative/out-of-range page numbers", async () => {
    const x = setup();
    for (const page of [0, -1, 1.1, 20001, "1"])
      expect(
        (
          await x.handler(
            x.request({ action: "list", expectedTenantId: tenantId, page }),
          )
        ).status,
      ).toBe(400);
  });
});
describe("existing programme form round trip", () => {
  it.each([
    "welcome",
    "win_back",
    "spend_gift",
    "department",
    "seasonal",
    "recognition",
    "multi_buy",
    "milestone",
    "referral",
    "birthday",
    "kindness",
  ])("preserves all %s fields while editing", (template) => {
    const d = createProgrammeDraft(
      template,
      "GBP",
      "2026-10-15",
      "Europe/London",
    );
    if (d.reward.kind === "gift")
      d.reward = { kind: "gift", sku: "SOAP", units: 2, costMinor: 500 };
    if (d.reward.kind === "experience")
      d.reward = { kind: "experience", reference: "lunch", costMinor: 300 };
    if (d.reward.kind === "multi_buy") d.eligibleSkus = ["PLANT"];
    const roundTrip = parseProgrammeForm(programmeFormFromDraft(d));
    expect(roundTrip).toEqual(d);
  });
});
describe("literal workbook ingestion", () => {
  const workbook = (sheet: Record<string, unknown>): WorkbookSource => ({
    name: "calendar.xlsx",
    epoch: "excel_1900",
    sheets: ["Plan"],
    workbook: { SheetNames: ["Plan"], Sheets: { Plan: sheet } },
  });
  it("preserves a formula as reviewable original data, never its invented result", async () => {
    const source = workbook({
      "!ref": "A1:B3",
      A1: { v: "Title" },
      B1: { v: "Date" },
      A2: { v: "Spring" },
      B2: { v: 45000, f: "TODAY()" },
      A3: { v: "Fall" },
      B3: { v: "2026-10-15" },
    });
    const out = await calendarWorkbookRows(source, "Plan", 1);
    expect(out.rows[0].Date).toEqual({
      formula: "TODAY()",
      cachedValue: 45000,
    });
    expect(out.rows).toHaveLength(2);
  });
  it("does not hide blank source rows", async () => {
    const source = workbook({
      "!ref": "A1:B3",
      A1: { v: "Title" },
      B1: { v: "Date" },
      A2: { v: "Spring" },
      B2: { v: "2027-04-01" },
    });
    expect((await calendarWorkbookRows(source, "Plan", 1)).rows[1]).toEqual({
      Title: "",
      Date: "",
    });
  });
  it("rejects duplicate headings and excessive ranges without silent truncation", async () => {
    await expect(
      calendarWorkbookRows(
        workbook({ "!ref": "A1:B2", A1: { v: "Date" }, B1: { v: "Date" } }),
        "Plan",
        1,
      ),
    ).rejects.toThrow("distinct");
    await expect(
      calendarWorkbookRows(workbook({ "!ref": "A1:B3000" }), "Plan", 1),
    ).rejects.toThrow("Nothing was truncated");
  });
});
