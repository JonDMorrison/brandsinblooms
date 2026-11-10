import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  createProgrammeHandler,
  executeProgrammeCommand,
  type ProgrammeContext,
} from "../../../../supabase/functions/_shared/loyalty/programme-service";
import { createProgrammeDraft } from "../../../../supabase/functions/_shared/loyalty/programme-templates";
import { calendarWorkbookRows, openCalendarWorkbook } from "../calendarWorkbook";
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
  const serializedWorkbook = (
    sheets: Record<string, Record<string, unknown>>,
    date1904 = false,
    bookType: "xlsx" | "biff8" | "xlml" | "ods" | "fods" = "xlsx",
  ): Uint8Array => {
    const output = XLSX.write(
      {
        SheetNames: Object.keys(sheets),
        Sheets: sheets,
        Workbook: { WBProps: { date1904 } },
      },
      { type: "array", bookType },
    );
    return output instanceof Uint8Array ? output : new Uint8Array(output);
  };
  const workbook = (sheet: Record<string, unknown>): WorkbookSource => ({
    name: "calendar.xlsx",
    epoch: "excel_1900",
    sheets: ["Plan"],
    bytes: serializedWorkbook({ Plan: sheet }),
  });
  const uploadedFile = (bytes: Uint8Array, name: string): File =>
    ({
      name,
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.slice().buffer,
    }) as File;

  it("preflights sheet metadata without losing the workbook date system", async () => {
    const bytes = serializedWorkbook(
      { Plan: { "!ref": "A1", A1: { v: "Title" } } },
      true,
    );
    const source = await openCalendarWorkbook(uploadedFile(bytes, "calendar.xlsx"));
    expect(source.sheets).toEqual(["Plan"]);
    expect(source.epoch).toBe("excel_1904");

    const defaultEpoch = await openCalendarWorkbook(
      uploadedFile(
        serializedWorkbook({
          Plan: { "!ref": "A1", A1: { v: "Title" } },
        }),
        "calendar.xlsx",
      ),
    );
    expect(defaultEpoch.epoch).toBe("excel_1900");
  });

  it("opens delimited calendars without an unbounded metadata parse", async () => {
    const source = await openCalendarWorkbook(
      uploadedFile(
        new TextEncoder().encode('Title,Notes\nSpring,"Email, SMS"'),
        "calendar.csv",
      ),
    );
    expect(source.sheets).toEqual(["Sheet1"]);
    expect(source.epoch).toBe("excel_1900");
    await expect(
      calendarWorkbookRows(source, "Sheet1", 1),
    ).resolves.toMatchObject({
      headers: ["Title", "Notes"],
      rows: [{ Title: "Spring", Notes: "Email, SMS" }],
    });
  });

  it("rejects excessive sheet counts during metadata preflight", async () => {
    const sheets = Object.fromEntries(
      Array.from({ length: 31 }, (_, index) => [
        `Plan ${index + 1}`,
        { "!ref": "A1", A1: { v: "Title" } },
      ]),
    );
    const bytes = serializedWorkbook(sheets);
    await expect(
      openCalendarWorkbook(uploadedFile(bytes, "calendar.xlsx")),
    ).rejects.toThrow("1 to 30 worksheets");
  });

  it("rejects multi-sheet legacy XLS renamed as XLSX before selected-sheet parsing", async () => {
    const bytes = serializedWorkbook(
      {
        Plan: { "!ref": "A1", A1: { v: "Title" } },
        More: { "!ref": "A1", A1: { v: "Title" } },
      },
      false,
      "biff8",
    );
    await expect(
      openCalendarWorkbook(uploadedFile(bytes, "calendar.xlsx")),
    ).rejects.toThrow("converted to XLSX");
  });

  it.each(["xlml", "ods", "fods"] as const)(
    "rejects multi-sheet %s content renamed as XLSX before selected-sheet parsing",
    async (bookType) => {
      const bytes = serializedWorkbook(
        {
          Plan: { "!ref": "A1", A1: { v: "Title" } },
          More: { "!ref": "A1", A1: { v: "Title" } },
        },
        false,
        bookType,
      );
      await expect(
        openCalendarWorkbook(uploadedFile(bytes, "calendar.xlsx")),
      ).rejects.toThrow("cannot be bounded safely");
    },
  );

  it.each(["ods", "fods"] as const)(
    "rejects unsupported single-sheet %s content renamed as XLSX",
    async (bookType) => {
      const bytes = serializedWorkbook(
        { Plan: { "!ref": "A1", A1: { t: "s", v: "Title" } } },
        false,
        bookType,
      );
      await expect(
        openCalendarWorkbook(uploadedFile(bytes, "calendar.xlsx")),
      ).rejects.toThrow("cannot be bounded safely");
    },
  );

  it("rejects legacy XLS bytes disguised as delimited text", async () => {
    const bytes = serializedWorkbook(
      {
        Plan: { "!ref": "A1", A1: { v: "Title" } },
        More: { "!ref": "A1", A1: { v: "Title" } },
      },
      false,
      "biff8",
    );
    await expect(
      openCalendarWorkbook(uploadedFile(bytes, "calendar.csv")),
    ).rejects.toThrow("not renamed as CSV or text");
  });

  it.each(["ods", "xlml"] as const)(
    "rejects %s workbook bytes disguised as delimited text",
    async (bookType) => {
      const bytes = serializedWorkbook(
        { Plan: { "!ref": "A1", A1: { v: "Title" } } },
        false,
        bookType,
      );
      const disguised =
        bookType === "xlml"
          ? new Uint8Array(bytes.length + 2048)
          : bytes;
      if (bookType === "xlml") {
        disguised.fill(0x20, 0, 2048);
        disguised.set(bytes, 2048);
      }
      await expect(
        openCalendarWorkbook(uploadedFile(disguised, "calendar.csv")),
      ).rejects.toThrow("not renamed as CSV or text");
    },
  );

  it("rejects a real offset worksheet instead of accepting truncated rows", async () => {
    const source = workbook({
      "!ref": "A3:A2102",
      A3: { v: "Title" },
      A2102: { v: "last source row" },
    });
    await expect(calendarWorkbookRows(source, "Plan", 3)).rejects.toThrow(
      "Nothing was imported or truncated",
    );
  });
  it("preserves a formula as reviewable original data, never its invented result", async () => {
    const source = workbook({
      "!ref": "A1:B3",
      A1: { v: "Title" },
      B1: { v: "Date" },
      A2: { v: "Spring" },
      B2: { t: "n", v: 45000, f: "TODAY()" },
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
    ).rejects.toThrow(/Nothing was .*truncated/);
  });
});
