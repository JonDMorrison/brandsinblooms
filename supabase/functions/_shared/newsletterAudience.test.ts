import {
  requestedNewsletterSegments,
  resolveNewsletterAudience,
} from "./newsletterAudience.ts";
import type { RenderableContentBlock } from "./campaignEmailContent.ts";
const tenant = "00000000-0000-4000-8000-000000000001";
const customer = "00000000-0000-4000-8000-000000000002";
const segment = "00000000-0000-4000-8000-000000000003";
const other = "00000000-0000-4000-8000-000000000004";
const blocks = [
  {
    id: "test",
    type: "plain-text",
    audience: { mode: "segments", segmentIds: [segment] },
  },
] as RenderableContentBlock[];
function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
}
async function withDatabase(
  replies: {
    customer?: unknown;
    segments?: unknown;
    membership?: unknown;
    error?: boolean;
  },
  run: (calls: URL[]) => Promise<void>,
) {
  const fetch = globalThis.fetch;
  const oldUrl = Deno.env.get("SUPABASE_URL");
  const oldKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const calls: URL[] = [];
  Deno.env.set("SUPABASE_URL", "https://newsletter-unit-test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "unit-test-not-a-real-key");
  globalThis.fetch = (request, init) => {
    const url = new URL(
      typeof request === "string"
        ? request
        : request instanceof URL
          ? request.href
          : request.url,
    );
    calls.push(url);
    let payload: unknown = [];
    if (url.pathname.endsWith("/crm_customers"))
      payload =
        replies.customer === undefined
          ? { id: customer, tenant_id: tenant, email: "test@example.invalid" }
          : replies.customer;
    else if (url.pathname.endsWith("/crm_segments"))
      payload = replies.segments || [
        {
          id: segment,
          auto_update: false,
          conditions: null,
          include_all_customers: false,
          status: "active",
        },
      ];
    else if (url.pathname.endsWith("/customer_segments"))
      payload = replies.membership || [];
    else throw new Error("Unexpected external request in audience test");
    return Promise.resolve(
      new Response(
        JSON.stringify(
          replies.error ? { message: "Test database unavailable" } : payload,
        ),
        {
          status: replies.error ? 503 : 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = fetch;
    if (oldUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", oldUrl);
    if (oldKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", oldKey);
  }
}
Deno.test("conditional newsletters collect only valid unique segment IDs", () =>
  equal(
    requestedNewsletterSegments([
      ...blocks,
      ...blocks,
      {
        type: "plain-text",
        audience: { mode: "segments", segmentIds: ["invalid"] },
      },
    ] as RenderableContentBlock[]),
    [segment],
  ),
);
Deno.test(
  "preview without a recipient explicitly includes all blocks; delivery does not",
  async () => {
    equal(
      await resolveNewsletterAudience({
        tenantId: tenant,
        blocks,
        preview: true,
      }),
      { previewAll: true },
    );
    equal(
      await resolveNewsletterAudience({
        tenantId: tenant,
        blocks,
        preview: false,
      }),
      { segmentIds: [] },
    );
  },
);
Deno.test(
  "conditional send requires same-tenant recipient and segment evidence",
  () =>
    withDatabase(
      { membership: [{ segment_id: segment }, { segment_id: other }] },
      async (calls) => {
        equal(
          await resolveNewsletterAudience({
            tenantId: tenant,
            customerId: customer,
            blocks,
            preview: false,
          }),
          { segmentIds: [segment] },
        );
        equal(calls.length, 3);
        if (
          !calls.every(
            (url) =>
              url.searchParams.get("tenant_id") === `eq.${tenant}` ||
              url.searchParams.get("crm_segments.tenant_id") === `eq.${tenant}`,
          )
        )
          throw new Error("Every query must be tenant-scoped");
      },
    ),
);
Deno.test(
  "a foreign or nonexistent customer cannot see restricted content",
  () =>
    withDatabase({ customer: null }, async (calls) => {
      equal(
        await resolveNewsletterAudience({
          tenantId: tenant,
          customerId: customer,
          blocks,
          preview: false,
        }),
        { segmentIds: [] },
      );
      equal(calls.length, 1);
    }),
);
Deno.test("missing membership and archived segments fail closed", () =>
  withDatabase(
    {
      segments: [
        {
          id: segment,
          auto_update: false,
          conditions: null,
          include_all_customers: false,
          status: "archived",
        },
      ],
      membership: [{ segment_id: segment }],
    },
    async () => {
      equal(
        await resolveNewsletterAudience({
          tenantId: tenant,
          customerId: customer,
          blocks,
          preview: false,
        }),
        { segmentIds: [] },
      );
    },
  ),
);
Deno.test("database failures stop conditional send for retry", () =>
  withDatabase({ error: true }, async () => {
    let rejected = false;
    try {
      await resolveNewsletterAudience({
        tenantId: tenant,
        customerId: customer,
        blocks,
        preview: false,
      });
    } catch {
      rejected = true;
    }
    equal(rejected, true);
  }),
);
