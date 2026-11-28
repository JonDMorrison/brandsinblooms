import {
  decideFormSegments,
  normalizeSegmentIdList,
  summarizeSkippedSegments,
  type FormSegmentRow,
} from "./formSegmentAssignment.ts";

const tenant = "00000000-0000-4000-8000-000000000001";
const otherTenant = "00000000-0000-4000-8000-000000000002";
const retail = "00000000-0000-4000-8000-0000000000a1";
const wholesale = "00000000-0000-4000-8000-0000000000a2";
const dynamic = "00000000-0000-4000-8000-0000000000a3";
const deleted = "00000000-0000-4000-8000-0000000000a4";
const archived = "00000000-0000-4000-8000-0000000000a5";
const foreign = "00000000-0000-4000-8000-0000000000a6";
const missing = "00000000-0000-4000-8000-0000000000a7";

function row(id: string, overrides: Partial<FormSegmentRow> = {}) {
  return {
    id,
    name: `Segment ${id.slice(-2)}`,
    tenant_id: tenant,
    auto_update: false,
    status: "active",
    deleted_at: null,
    ...overrides,
  } satisfies FormSegmentRow;
}

const rows: FormSegmentRow[] = [
  row(retail, { name: "Retail" }),
  row(wholesale, { name: "Wholesale" }),
  row(dynamic, { auto_update: true }),
  row(deleted, { deleted_at: "2026-11-01T00:00:00Z" }),
  row(archived, { status: "archived" }),
  row(foreign, { tenant_id: otherTenant }),
];

function assertEquals(actual: unknown, expected: unknown) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`Expected ${right}, got ${left}`);
  }
}

Deno.test(
  "automatic assignment joins every static segment of the tenant",
  () => {
    const decision = decideFormSegments({
      requestedIds: [retail, wholesale],
      rows,
      tenantId: tenant,
      allowDynamic: false,
    });

    assertEquals(decision.assignable, [
      { id: retail, name: "Retail" },
      { id: wholesale, name: "Wholesale" },
    ]);
    assertEquals(decision.skipped, []);
  },
);

Deno.test("another tenant's segment is rejected as not found", () => {
  const decision = decideFormSegments({
    requestedIds: [foreign, retail],
    rows,
    tenantId: tenant,
    allowDynamic: false,
  });

  assertEquals(decision.assignable, [{ id: retail, name: "Retail" }]);
  assertEquals(decision.skipped, [{ id: foreign, reason: "not_found" }]);
});

Deno.test(
  "deleted, archived, missing and malformed ids are never assigned",
  () => {
    const decision = decideFormSegments({
      requestedIds: [deleted, archived, missing, "not-a-uuid"],
      rows,
      tenantId: tenant,
      allowDynamic: true,
    });

    assertEquals(decision.assignable, []);
    assertEquals(decision.skipped, [
      { id: deleted, reason: "deleted" },
      { id: archived, reason: "inactive" },
      { id: missing, reason: "not_found" },
      { id: "not-a-uuid", reason: "invalid_id" },
    ]);
    assertEquals(summarizeSkippedSegments(decision.skipped), {
      deleted: 1,
      inactive: 1,
      not_found: 1,
      invalid_id: 1,
    });
  },
);

Deno.test("automatic assignment does not override a rule-based segment", () => {
  const automatic = decideFormSegments({
    requestedIds: [dynamic],
    rows,
    tenantId: tenant,
    allowDynamic: false,
  });
  assertEquals(automatic.assignable, []);
  assertEquals(automatic.skipped, [{ id: dynamic, reason: "dynamic" }]);

  const optIn = decideFormSegments({
    requestedIds: [dynamic],
    rows,
    tenantId: tenant,
    allowDynamic: true,
  });
  assertEquals(
    optIn.assignable.map((segment) => segment.id),
    [dynamic],
  );
});

Deno.test("segment id lists are trimmed, lower-cased and de-duplicated", () => {
  assertEquals(
    normalizeSegmentIdList([retail, ` ${retail.toUpperCase()} `, "", null, 7]),
    [retail],
  );
  assertEquals(normalizeSegmentIdList("nope"), []);
  assertEquals(summarizeSkippedSegments([]), null);
});
