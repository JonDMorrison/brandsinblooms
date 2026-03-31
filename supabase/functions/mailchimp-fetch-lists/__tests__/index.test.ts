import { assertEquals } from "@std/assert";

import { handleMailchimpFetchLists } from "../index.ts";
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

Deno.test(
  "mailchimp-fetch-lists authenticates the request before calling Mailchimp",
  async () => {
    let called = false;
    const { client: authClient } = createMockSupabaseClient({});
    const { client: serviceClient } = createMockSupabaseClient({});

    const response = await handleMailchimpFetchLists(
      jsonRequest("https://example.test", {}),
      {
        createClient: createClientFactory(authClient, serviceClient) as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_ANON_KEY: "anon-key",
        }),
        mailchimpFromConnection: async () => {
          called = true;
          throw new Error("should not be called");
        },
      },
    );

    assertEquals(response.status, 400);
    assertEquals(called, false);
  },
);

Deno.test(
  "mailchimp-fetch-lists writes one provider_artifact row per list and segment and returns totals",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient, recorder } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          id: "connection-1",
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
        },
        error: null,
      },
      "import_jobs:select": { data: [], error: null },
      "import_jobs:insert": { data: { id: "cache-job-1" }, error: null },
      "provider_artifacts:upsert": { data: null, error: null },
    });

    const response = await handleMailchimpFetchLists(
      jsonRequest(
        "https://example.test",
        {},
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: createClientFactory(authClient, serviceClient) as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_ANON_KEY: "anon-key",
        }),
        mailchimpFromConnection: async () =>
          ({
            getLists: async () => [
              {
                id: "list-1",
                name: "Main Audience",
                stats: { member_count: 30 },
              },
            ],
            getSegments: async () => [
              { id: 10, name: "VIP", member_count: 12, type: "saved" },
              { id: 11, name: "Recent", member_count: 4, type: "saved" },
            ],
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.totalLists, 1);
    assertEquals(body.totalSegments, 2);

    const artifactUpsert = recorder.find(
      (entry) =>
        entry.table === "provider_artifacts" && entry.operation === "upsert",
    );
    const payload = artifactUpsert?.payload as Array<Record<string, unknown>>;
    assertEquals(payload.length, 3);
    assertEquals(payload[0].artifact_type, "list");
    assertEquals(payload[1].external_id, "list-1:10");
    assertEquals(payload[2].external_id, "list-1:11");
  },
);

Deno.test(
  "mailchimp-fetch-lists handles accounts with no lists gracefully",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient, recorder } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          id: "connection-1",
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
        },
        error: null,
      },
      "import_jobs:select": { data: [], error: null },
      "import_jobs:insert": { data: { id: "cache-job-1" }, error: null },
    });

    const response = await handleMailchimpFetchLists(
      jsonRequest(
        "https://example.test",
        {},
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: createClientFactory(authClient, serviceClient) as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_ANON_KEY: "anon-key",
        }),
        mailchimpFromConnection: async () =>
          ({
            getLists: async () => [],
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.totalLists, 0);
    assertEquals(body.totalSegments, 0);
    assertEquals(body.lists, []);
    assertEquals(
      recorder.some(
        (entry) =>
          entry.table === "provider_artifacts" && entry.operation === "upsert",
      ),
      false,
    );
  },
);
