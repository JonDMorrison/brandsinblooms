import { assertEquals, assertStringIncludes } from "@std/assert";

import { makeEnv } from "../testing/testHarness.ts";
import {
  dispatchWebhook,
  type WebhookDispatchDependencies,
} from "../webhookDispatch.ts";

const FIXED_NOW = new Date("2026-04-28T10:00:00.000Z");

async function computeSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function makeDependencies(params: {
  registrations: Array<Record<string, unknown>>;
  fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
}) {
  const logEntries: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "oauth_webhook_registrations") {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: params.registrations,
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "oauth_webhook_logs") {
        return {
          insert(payload: unknown) {
            logEntries.push(payload as Record<string, unknown>);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const deps: WebhookDispatchDependencies = {
    createClient: () => client as never,
    envGet: makeEnv({
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    fetch: params.fetchImpl,
    now: () => FIXED_NOW,
    randomUUID: () => "webhook-id-1",
  };

  return { deps, logEntries };
}

Deno.test(
  "dispatchWebhook signs payloads and logs successful deliveries",
  async () => {
    let capturedHeaders: HeadersInit | null = null;
    let capturedBody: BodyInit | null = null;

    const { deps, logEntries } = makeDependencies({
      registrations: [
        {
          id: "registration-1",
          client_id: "bloomsuite-cms",
          webhook_url: "https://cms.example.test/api/webhooks/crm",
          events: ["subscription.updated"],
          signing_secret: "shared-secret",
        },
      ],
      fetchImpl: (_input, init) => {
        capturedHeaders = init.headers ?? null;
        capturedBody = init.body ?? null;
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    });

    await dispatchWebhook(
      "subscription.updated",
      { plan: "bloom", status: "active" },
      { userId: "user-1", tenantId: "tenant-1" },
      deps,
    );

    if (!capturedHeaders || typeof capturedBody !== "string") {
      throw new Error("Expected webhook request to be captured");
    }

    const headers = capturedHeaders as Record<string, string>;
    const bodyText = capturedBody;
    const parsedBody = JSON.parse(bodyText);

    assertEquals(parsedBody.event, "subscription.updated");
    assertEquals(parsedBody.data.user_id, "user-1");
    assertEquals(parsedBody.data.tenant_id, "tenant-1");
    assertEquals(parsedBody.data.plan, "bloom");
    assertEquals(headers["X-Webhook-Id"], "webhook-id-1");
    assertEquals(headers["X-Webhook-Timestamp"], "1777370400");
    assertEquals(
      headers["X-Webhook-Signature"],
      `sha256=${await computeSignature("shared-secret", bodyText)}`,
    );

    assertEquals(logEntries.length, 1);
    assertEquals(logEntries[0].event, "subscription.updated");
    assertEquals(logEntries[0].response_status, 200);
    assertEquals(logEntries[0].delivered_at, FIXED_NOW.toISOString());
    assertEquals(logEntries[0].failed_at, null);
  },
);

Deno.test(
  "dispatchWebhook logs failed deliveries without throwing",
  async () => {
    const { deps, logEntries } = makeDependencies({
      registrations: [
        {
          id: "registration-1",
          client_id: "bloomsuite-cms",
          webhook_url: "https://cms.example.test/api/webhooks/crm",
          events: ["subscription.updated"],
          signing_secret: "shared-secret",
        },
      ],
      fetchImpl: () => {
        return Promise.resolve(
          new Response("failed delivery", { status: 500 }),
        );
      },
    });

    await dispatchWebhook(
      "subscription.updated",
      { plan: "bloom", status: "past_due" },
      undefined,
      deps,
    );

    assertEquals(logEntries.length, 1);
    assertEquals(logEntries[0].response_status, 500);
    assertEquals(logEntries[0].delivered_at, null);
    assertEquals(logEntries[0].failed_at, FIXED_NOW.toISOString());
    assertStringIncludes(
      logEntries[0].response_body as string,
      "failed delivery",
    );
  },
);
