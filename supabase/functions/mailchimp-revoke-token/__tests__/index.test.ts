import { assertEquals } from "@std/assert";

import { handleMailchimpRevokeToken } from "../index.ts";
import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";

function createClientFactory(authClient: unknown, serviceClient: unknown) {
  return (_url: string, key: string) => {
    if (key === "anon-key") {
      return authClient;
    }
    return serviceClient;
  };
}

Deno.test("mailchimp-revoke-token requires authentication", async () => {
  const { client: authClient } = createMockSupabaseClient({});
  const { client: serviceClient } = createMockSupabaseClient({});

  const response = await handleMailchimpRevokeToken(
    jsonRequest("https://example.test", { provider: "mailchimp" }),
    {
      createClient: createClientFactory(authClient, serviceClient) as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_ANON_KEY: "anon-key",
      }),
      decryptToken: async () => "token",
      fetch: async () => new Response(null, { status: 200 }),
      now: () => "2026-03-30T00:00:00.000Z",
    },
  );

  assertEquals(response.status, 401);
});

Deno.test(
  "mailchimp-revoke-token revokes remotely before clearing the local token and artifacts",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient, recorder } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          id: "conn-1",
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
        },
        error: null,
      },
      "provider_connections:update": { data: null, error: null },
      "provider_artifacts:delete": { data: null, error: null },
      "import_jobs:update": { data: null, error: null },
    });

    const callOrder: string[] = [];

    const response = await handleMailchimpRevokeToken(
      jsonRequest(
        "https://example.test",
        { provider: "mailchimp" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: createClientFactory(authClient, serviceClient) as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_ANON_KEY: "anon-key",
        }),
        decryptToken: async () => "plain-token",
        fetch: async () => {
          callOrder.push("remote-revoke");
          return new Response(null, { status: 200 });
        },
        now: () => "2026-03-30T00:00:00.000Z",
      },
    );

    assertEquals(response.status, 200);
    const updateEntry = recorder.find(
      (entry) =>
        entry.table === "provider_connections" && entry.operation === "update",
    );
    const updatePayload = updateEntry?.payload as Record<string, unknown>;
    assertEquals(callOrder[0], "remote-revoke");
    assertEquals(updatePayload.status, "revoked");
    assertEquals(updatePayload.revoked_at, "2026-03-30T00:00:00.000Z");
    assertEquals(updatePayload.encrypted_access_token, null);
    const deleteEntry = recorder.find(
      (entry) =>
        entry.table === "provider_artifacts" && entry.operation === "delete",
    );
    assertEquals(deleteEntry?.filters[0].value, "tenant-1");
    const pendingJobsEntry = recorder.find(
      (entry) => entry.table === "import_jobs" && entry.operation === "update",
    );
    const pendingJobsPayload = pendingJobsEntry?.payload as Record<
      string,
      unknown
    >;
    assertEquals(pendingJobsPayload.status, "failed");
    assertEquals(pendingJobsPayload.error_details, "Provider disconnected");
  },
);

Deno.test("mailchimp-revoke-token rejects invalid providers", async () => {
  const { client: authClient } = createMockSupabaseClient({});
  const { client: serviceClient } = createMockSupabaseClient({});

  const response = await handleMailchimpRevokeToken(
    jsonRequest(
      "https://example.test",
      { provider: "constant_contact" },
      { headers: { Authorization: "Bearer token" } },
    ),
    {
      createClient: createClientFactory(authClient, serviceClient) as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_ANON_KEY: "anon-key",
      }),
      decryptToken: async () => "token",
      fetch: async () => new Response(null, { status: 200 }),
      now: () => "2026-03-30T00:00:00.000Z",
    },
  );

  assertEquals(response.status, 500);
});
