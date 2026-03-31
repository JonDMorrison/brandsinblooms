import { assertEquals } from "@std/assert";

import { handleMailchimpFetchPreview } from "../index.ts";
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
  "mailchimp-fetch-preview estimates full-list imports when no segments are selected",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "import_jobs:select": {
        data: { config: { listIds: ["list-1"], segmentIds: [] } },
        error: null,
      },
      "provider_connections:select": {
        data: { encrypted_access_token: "encrypted", metadata: { dc: "us1" } },
        error: null,
      },
      "crm_customers:select": {
        data: [{ email: "a@example.com" }],
        error: null,
      },
    });

    const response = await handleMailchimpFetchPreview(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
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
            getList: async () => ({
              id: "list-1",
              name: "Audience",
              stats: { member_count: 100 },
            }),
            getListMembers: async () => ({
              total_items: 100,
              members: [
                {
                  email_address: "a@example.com",
                  merge_fields: {},
                  tags: [],
                  status: "subscribed",
                },
                {
                  email_address: "b@example.com",
                  merge_fields: {},
                  tags: [],
                  status: "subscribed",
                },
              ],
            }),
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.estimatedImportCount, 100);
    assertEquals(body.alreadyInCRM, 50);
    assertEquals(body.newContacts, 50);
  },
);

Deno.test(
  "mailchimp-fetch-preview uses selected segment counts when segments are selected",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "import_jobs:select": {
        data: { config: { listIds: ["list-1"], segmentIds: ["list-1:10"] } },
        error: null,
      },
      "provider_connections:select": {
        data: { encrypted_access_token: "encrypted", metadata: { dc: "us1" } },
        error: null,
      },
      "provider_artifacts:select": {
        data: [{ external_id: "list-1:10", name: "VIP", member_count: 12 }],
        error: null,
      },
      "crm_customers:select": { data: [], error: null },
    });

    let listMembersCalls = 0;
    let segmentMembersCalls = 0;

    const response = await handleMailchimpFetchPreview(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
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
            getList: async () => ({
              id: "list-1",
              name: "Audience",
              stats: { member_count: 100 },
            }),
            getListMembers: async () => {
              listMembersCalls += 1;
              return { total_items: 100, members: [] };
            },
            getSegmentMembers: async () => {
              segmentMembersCalls += 1;
              return {
                total_items: 12,
                members: [
                  {
                    email_address: "vip@example.com",
                    merge_fields: {},
                    tags: [],
                    status: "subscribed",
                  },
                ],
              };
            },
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.estimatedImportCount, 12);
    assertEquals(body.selectedSegments.length, 1);
    assertEquals(listMembersCalls, 0);
    assertEquals(segmentMembersCalls, 1);
  },
);

Deno.test(
  "mailchimp-fetch-preview returns an error when no list can be resolved",
  async () => {
    const { client: authClient } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
    });
    const { client: serviceClient } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "import_jobs:select": {
        data: { config: { listIds: [], segmentIds: [] } },
        error: null,
      },
      "provider_connections:select": {
        data: { encrypted_access_token: "encrypted", metadata: { dc: "us1" } },
        error: null,
      },
    });

    const response = await handleMailchimpFetchPreview(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: createClientFactory(authClient, serviceClient) as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          SUPABASE_ANON_KEY: "anon-key",
        }),
        mailchimpFromConnection: async () => ({}) as never,
      },
    );

    assertEquals(response.status, 500);
  },
);
