import { assertEquals } from "@std/assert";

import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import {
  handleOAuthSubscriptionStatus,
  type OAuthSubscriptionStatusDependencies,
} from "../index.ts";

const NOW = new Date("2026-04-28T10:00:00.000Z");

function validToken(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sub: "11111111-1111-4111-8111-111111111111",
    scope: "openid profile subscription",
    client_id: "bloomsuite-cms",
    grant_type: "authorization_code",
    exp: 1,
    iat: 1,
    iss: "https://bloomsuite.app",
    aud: "https://bloomsuite.app",
    ...overrides,
  };
}

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  overrides: Partial<OAuthSubscriptionStatusDependencies> = {},
) {
  const { client, recorder } = createMockSupabaseClient(seededResponses);
  const deps: OAuthSubscriptionStatusDependencies = {
    createClient: () => client as never,
    envGet: makeEnv({
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    now: () => NOW,
    verifyAccessToken: () => Promise.resolve(validToken() as never),
    ...overrides,
  };

  return { deps, recorder };
}

function authHeaders() {
  return { Authorization: "Bearer test-access-token" };
}

Deno.test(
  "oauth-subscription-status returns the caller subscription snapshot",
  async () => {
    const { deps } = makeDependencies({
      "users:select": {
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          tenant_id: "tenant-1",
        },
        error: null,
      },
      "subscriptions:select": {
        data: {
          plan: "sprout",
          tier: "sprout",
          status: "active",
          billing_interval: "monthly",
          current_period_start: "2026-04-01T00:00:00.000Z",
          current_period_end: "2026-05-01T00:00:00.000Z",
          cancel_at_period_end: false,
          trial_end: null,
          start_date: "2026-04-01",
          end_date: "2026-05-01",
          deleted_at: null,
          max_connections: 12,
        },
        error: null,
      },
      "plan_definitions:select": {
        data: { max_products: 4321 },
        error: null,
      },
    });

    const response = await handleOAuthSubscriptionStatus(
      new Request(
        "https://example.test/functions/v1/oauth-subscription-status",
        {
          method: "GET",
          headers: authHeaders(),
        },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "tenant-1",
      subscription: {
        plan: "sprout",
        plan_display_name: "Sprout Plan",
        status: "active",
        is_active: true,
        can_access_premium: true,
        billing_interval: "monthly",
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        cancel_at_period_end: false,
        trial_end: null,
        feature_limits: {
          max_sites: 12,
          max_products: 4321,
          custom_domain: true,
          remove_branding: false,
          priority_support: false,
        },
      },
    });
  },
);

Deno.test(
  "oauth-subscription-status requires user_id for client credentials tokens",
  async () => {
    const { deps } = makeDependencies(
      {},
      {
        verifyAccessToken: () =>
          Promise.resolve(
            validToken({
              sub: "bloomsuite-cms-m2m",
              scope: "subscription:read",
              client_id: "bloomsuite-cms-m2m",
              grant_type: "client_credentials",
            }) as never,
          ),
      },
    );

    const response = await handleOAuthSubscriptionStatus(
      new Request(
        "https://example.test/functions/v1/oauth-subscription-status",
        {
          method: "GET",
          headers: authHeaders(),
        },
      ),
      deps,
    );

    assertEquals(response.status, 400);
    assertEquals(await response.json(), {
      error: "invalid_request",
      error_description:
        "client_credentials tokens must include a user_id query parameter.",
    });
  },
);

Deno.test(
  "oauth-subscription-status returns null when the user has no subscription",
  async () => {
    const { deps } = makeDependencies(
      {
        "users:select": {
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            tenant_id: "tenant-1",
          },
          error: null,
        },
        "subscriptions:select": {
          data: null,
          error: null,
        },
      },
      {
        verifyAccessToken: () =>
          Promise.resolve(
            validToken({
              sub: "bloomsuite-cms-m2m",
              scope: "subscription:read",
              client_id: "bloomsuite-cms-m2m",
              grant_type: "client_credentials",
            }) as never,
          ),
      },
    );

    const response = await handleOAuthSubscriptionStatus(
      new Request(
        "https://example.test/functions/v1/oauth-subscription-status?user_id=11111111-1111-4111-8111-111111111111",
        {
          method: "GET",
          headers: authHeaders(),
        },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "tenant-1",
      subscription: null,
    });
  },
);
