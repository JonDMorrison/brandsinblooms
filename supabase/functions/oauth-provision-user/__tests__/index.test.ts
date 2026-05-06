import { assertEquals } from "@std/assert";

import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import {
  handleOAuthProvisionUser,
  type OAuthProvisionUserDependencies,
} from "../index.ts";

const NOW = new Date("2026-04-27T18:30:15.000Z");

function validToken(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sub: "bloomsuite-cms-m2m",
    scope: "user:provision subscription:read",
    client_id: "bloomsuite-cms-m2m",
    grant_type: "client_credentials",
    exp: 1,
    iat: 1,
    iss: "https://bloomsuite.app",
    aud: "https://bloomsuite.app",
    ...overrides,
  };
}

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  overrides: Partial<OAuthProvisionUserDependencies> = {},
) {
  const { client, recorder } = createMockSupabaseClient(seededResponses);
  const deps: OAuthProvisionUserDependencies = {
    createClient: () => client as never,
    envGet: makeEnv({
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    now: () => NOW,
    verifyAccessToken: () => Promise.resolve(validToken() as never),
    generatePassword: () => "Aa1!".repeat(18),
    ...overrides,
  };

  return { deps, recorder };
}

function authHeaders() {
  return { Authorization: "Bearer test-access-token" };
}

function findRecordedMethod(
  recorder: Array<{ payload?: unknown; table: string; operation: string }>,
  methodName: string,
) {
  return recorder.find((entry) => {
    if (entry.table !== "auth" || entry.operation !== "rpc") {
      return false;
    }

    const payload = entry.payload as { method?: string } | undefined;
    return payload?.method === methodName;
  });
}

Deno.test(
  "oauth-provision-user creates a new CRM account and external link",
  async () => {
    const { deps, recorder } = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": [
        { data: 1, error: null },
        { data: 1, error: null },
      ],
      "auth:admin:listUsers": {
        data: { users: [] },
        error: null,
      },
      "auth:admin:createUser": {
        data: {
          user: {
            id: "user-1",
            email: "user@example.com",
            email_confirmed_at: NOW.toISOString(),
            user_metadata: {
              full_name: "Jane Doe",
              company_name: "Jane's Garden Centre",
            },
          },
        },
        error: null,
      },
      "users:select": [
        { data: null, error: null },
        {
          data: {
            id: "user-1",
            email: "user@example.com",
            tenant_id: "tenant-1",
            full_name: "Jane Doe",
            name: "Jane Doe",
          },
          error: null,
        },
      ],
      "tenants:insert": {
        data: { id: "tenant-1" },
        error: null,
      },
      "users:upsert": { data: null, error: null },
      "company_profiles:select": [
        { data: null, error: null },
        {
          data: {
            company_name: "Jane's Garden Centre",
            feature_flags: { crm_enabled: true },
          },
          error: null,
        },
      ],
      "company_profiles:upsert": { data: null, error: null },
      "subscriptions:select": {
        data: [
          {
            plan: "free_trial",
            tier: null,
            end_date: "2026-05-04",
            deleted_at: null,
            created_at: NOW.toISOString(),
          },
        ],
        error: null,
      },
      "user_external_links:select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "user_external_links:upsert": { data: null, error: null },
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "User@example.com",
          full_name: "Jane Doe",
          company_name: "Jane's Garden Centre",
          source: "cms_signup",
          external_id: "cms-user-123",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      crm_user_id: "user-1",
      email: "user@example.com",
      full_name: "Jane Doe",
      is_new: true,
      tenant_id: "tenant-1",
      subscription: {
        plan: "free_trial",
        status: "trialing",
        expires_at: "2026-05-04T00:00:00.000Z",
      },
    });

    const createUserRecord = findRecordedMethod(recorder, "admin.createUser");
    assertEquals(createUserRecord !== undefined, true);
    assertEquals(
      (createUserRecord?.payload as { attributes?: { password?: string } })
        ?.attributes?.password,
      "Aa1!".repeat(18),
    );

    const linkUpsert = recorder.find(
      (entry) =>
        entry.table === "user_external_links" && entry.operation === "upsert",
    );
    assertEquals(linkUpsert?.payload, {
      user_id: "user-1",
      provider: "cms",
      external_id: "cms-user-123",
    });
  },
);

Deno.test(
  "oauth-provision-user is idempotent for an existing email",
  async () => {
    const { deps, recorder } = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": [
        { data: 1, error: null },
        { data: 1, error: null },
      ],
      "auth:admin:listUsers": {
        data: {
          users: [
            {
              id: "user-1",
              email: "user@example.com",
              email_confirmed_at: "2026-04-01T12:00:00.000Z",
              user_metadata: { full_name: "Existing User" },
            },
          ],
        },
        error: null,
      },
      "users:select": [
        {
          data: {
            id: "user-1",
            email: "user@example.com",
            tenant_id: "tenant-1",
            full_name: "Existing User",
            name: "Existing User",
          },
          error: null,
        },
        {
          data: {
            id: "user-1",
            email: "user@example.com",
            tenant_id: "tenant-1",
            full_name: "Existing User",
            name: "Existing User",
          },
          error: null,
        },
      ],
      "company_profiles:select": [
        {
          data: {
            company_name: "Existing Gardens",
            feature_flags: { crm_enabled: true },
          },
          error: null,
        },
        {
          data: {
            company_name: "Existing Gardens",
            feature_flags: { crm_enabled: true },
          },
          error: null,
        },
      ],
      "subscriptions:select": {
        data: [
          {
            plan: "bloom_pro",
            tier: "bloom_pro",
            end_date: "2026-06-01T00:00:00.000Z",
            deleted_at: null,
            created_at: NOW.toISOString(),
          },
        ],
        error: null,
      },
      "user_external_links:select": [
        { data: null, error: null },
        { data: null, error: null },
      ],
      "user_external_links:upsert": { data: null, error: null },
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          full_name: "Jane Doe",
          company_name: "Jane's Garden Centre",
          source: "cms_signup",
          external_id: "cms-user-123",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      crm_user_id: "user-1",
      email: "user@example.com",
      full_name: "Existing User",
      is_new: false,
      tenant_id: "tenant-1",
      subscription: {
        plan: "bloom_pro",
        status: "active",
        expires_at: "2026-06-01T00:00:00.000Z",
      },
    });
    assertEquals(findRecordedMethod(recorder, "admin.createUser"), undefined);
  },
);

Deno.test(
  "oauth-provision-user rejects tokens without the provisioning scope",
  async () => {
    const { deps } = makeDependencies(
      {
        "oauth_provisioning_audit_logs:insert": { data: null, error: null },
      },
      {
        verifyAccessToken: () =>
          Promise.resolve(validToken({ scope: "subscription:read" }) as never),
      },
    );

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          full_name: "Jane Doe",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 403);
    assertEquals(await response.json(), { error: "insufficient_scope" });
  },
);

Deno.test(
  "oauth-provision-user rejects non-M2M user-context tokens",
  async () => {
    const { deps } = makeDependencies(
      {
        "oauth_provisioning_audit_logs:insert": { data: null, error: null },
      },
      {
        verifyAccessToken: () =>
          Promise.resolve(
            validToken({
              sub: "user-1",
              client_id: "bloomsuite-cms",
              grant_type: "authorization_code",
            }) as never,
          ),
      },
    );

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          full_name: "Jane Doe",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 403);
    assertEquals(await response.json(), { error: "invalid_grant_type" });
  },
);

Deno.test(
  "oauth-provision-user validates required fields and email format",
  async () => {
    const invalidEmail = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": [
        { data: 1, error: null },
        { data: 1, error: null },
      ],
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });

    const invalidEmailResponse = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "not-an-email",
          full_name: "Jane Doe",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      invalidEmail.deps,
    );
    assertEquals(invalidEmailResponse.status, 400);
    assertEquals(await invalidEmailResponse.json(), { error: "invalid_email" });

    const missingField = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": {
        data: 1,
        error: null,
      },
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });
    const missingFieldResponse = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      missingField.deps,
    );
    assertEquals(missingFieldResponse.status, 400);
    assertEquals(await missingFieldResponse.json(), {
      error: "invalid_request",
    });
  },
);

Deno.test(
  "oauth-provision-user returns 429 with Retry-After when client rate limit is exceeded",
  async () => {
    const { deps, recorder } = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": {
        data: 101,
        error: null,
      },
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          full_name: "Jane Doe",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), "45");
    assertEquals(await response.json(), { error: "rate_limit_exceeded" });
    assertEquals(findRecordedMethod(recorder, "admin.listUsers"), undefined);
  },
);

Deno.test(
  "oauth-provision-user creates a fallback subscription when the signup trigger missed it",
  async () => {
    const { deps, recorder } = makeDependencies({
      "rpc:upsert_oauth_provisioning_rate_limit": [
        { data: 1, error: null },
        { data: 1, error: null },
      ],
      "auth:admin:listUsers": {
        data: {
          users: [
            {
              id: "user-1",
              email: "user@example.com",
              email_confirmed_at: "2026-04-01T12:00:00.000Z",
              user_metadata: { full_name: "Existing User" },
            },
          ],
        },
        error: null,
      },
      "users:select": [
        {
          data: {
            id: "user-1",
            email: "user@example.com",
            tenant_id: "tenant-1",
            full_name: "Existing User",
            name: "Existing User",
          },
          error: null,
        },
        {
          data: {
            id: "user-1",
            email: "user@example.com",
            tenant_id: "tenant-1",
            full_name: "Existing User",
            name: "Existing User",
          },
          error: null,
        },
      ],
      "company_profiles:select": [
        {
          data: {
            company_name: "Existing Gardens",
            feature_flags: { crm_enabled: true },
          },
          error: null,
        },
        {
          data: {
            company_name: "Existing Gardens",
            feature_flags: { crm_enabled: true },
          },
          error: null,
        },
      ],
      "subscriptions:select": [
        { data: [], error: null },
        {
          data: [
            {
              plan: "free_trial",
              tier: null,
              end_date: "2026-05-04",
              deleted_at: null,
              created_at: NOW.toISOString(),
            },
          ],
          error: null,
        },
      ],
      "subscriptions:insert": { data: null, error: null },
      "oauth_provisioning_audit_logs:insert": { data: null, error: null },
    });

    const response = await handleOAuthProvisionUser(
      jsonRequest(
        "https://example.test/functions/v1/oauth-provision-user",
        {
          email: "user@example.com",
          full_name: "Jane Doe",
          source: "cms_signup",
        },
        { headers: authHeaders() },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      crm_user_id: "user-1",
      email: "user@example.com",
      full_name: "Existing User",
      is_new: false,
      tenant_id: "tenant-1",
      subscription: {
        plan: "free_trial",
        status: "trialing",
        expires_at: "2026-05-04T00:00:00.000Z",
      },
    });
    const subscriptionInsert = recorder.find(
      (entry) =>
        entry.table === "subscriptions" && entry.operation === "insert",
    );
    assertEquals(subscriptionInsert?.payload, {
      user_id: "user-1",
      plan: "free_trial",
      start_date: "2026-04-27",
      end_date: "2026-05-04",
    });
  },
);
