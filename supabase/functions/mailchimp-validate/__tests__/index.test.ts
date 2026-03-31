import { assertEquals } from "@std/assert";

import { handleMailchimpValidate } from "../index.ts";
import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";

Deno.test(
  "mailchimp-validate returns 401 when authentication fails",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: null }, error: { message: "expired" } },
    });

    const response = await handleMailchimpValidate(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
        mailchimpFromConnection: async () => ({}) as never,
      },
    );

    assertEquals(response.status, 401);
  },
);

Deno.test(
  "mailchimp-validate returns valid=false when Mailchimp ping fails",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
      "import_jobs:select": {
        data: { config: { listIds: ["list-1"] }, tenant_id: "tenant-1" },
        error: null,
      },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
          status: "connected",
        },
        error: null,
      },
    });

    const response = await handleMailchimpValidate(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
        mailchimpFromConnection: async () =>
          ({
            ping: async () => false,
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.valid, false);
    assertEquals(body.checks[0].name, "connection_active");
    assertEquals(body.checks[1].name, "api_reachable");
  },
);

Deno.test(
  "mailchimp-validate fails fast when the Mailchimp connection is not active",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
      "import_jobs:select": {
        data: { config: { listIds: ["list-1"] }, tenant_id: "tenant-1" },
        error: null,
      },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
          status: "revoked",
        },
        error: null,
      },
    });

    let pingCalled = false;

    const response = await handleMailchimpValidate(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
        mailchimpFromConnection: async () =>
          ({
            ping: async () => {
              pingCalled = true;
              return true;
            },
          }) as never,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.valid, false);
    assertEquals(body.checks[0].name, "connection_active");
    assertEquals(body.checks[0].passed, false);
    assertEquals(pingCalled, false);
  },
);

Deno.test(
  "mailchimp-validate returns validation errors for invalid emails",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
      "import_jobs:select": {
        data: {
          config: { listIds: ["list-1"], segmentIds: ["list-1:10"] },
          tenant_id: "tenant-1",
        },
        error: null,
      },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": {
        data: {
          encrypted_access_token: "encrypted",
          metadata: { dc: "us1" },
          status: "connected",
        },
        error: null,
      },
      "crm_customers:select": { data: null, error: null },
    });

    const response = await handleMailchimpValidate(
      jsonRequest(
        "https://example.test",
        { jobId: "job-1" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
        mailchimpFromConnection: async () =>
          ({
            ping: async () => true,
            getListMembers: async () => ({
              members: [
                {
                  email_address: "bad-email",
                  merge_fields: {},
                  tags: [],
                  status: "subscribed",
                },
              ],
            }),
            getSegmentMembers: async () => ({
              members: [
                {
                  email_address: "also-bad",
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
    assertEquals(body.valid, false);
    assertEquals(body.validationErrors.length, 2);
    assertEquals(body.checks[2].name, "email_format");
    assertEquals(body.checks[3].name, "duplicate_detection");
  },
);
