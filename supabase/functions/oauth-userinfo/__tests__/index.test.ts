import { assertEquals } from "@std/assert";

import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import {
  handleOAuthUserinfo,
  type OAuthUserinfoDependencies,
} from "../index.ts";

const VERIFIED_TOKEN = {
  sub: "user-1",
  scope: "openid profile email subscription",
  client_id: "bloomsuite-cms",
  grant_type: "authorization_code",
  exp: 1_777_306_300,
  iat: 1_777_305_400,
  iss: "https://bloomsuite.app",
  aud: "bloomsuite-cms",
} as const;

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  overrides: Partial<OAuthUserinfoDependencies> = {},
) {
  const { client, recorder } = createMockSupabaseClient(seededResponses);

  return {
    recorder,
    deps: {
      createClient: () => client as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
      now: () => new Date("2026-04-27T16:00:00.000Z"),
      verifyAccessToken: () => Promise.resolve(VERIFIED_TOKEN),
      ...overrides,
    } satisfies OAuthUserinfoDependencies,
  };
}

function authorizedRequest(method: "GET" | "POST" = "GET") {
  return new Request("https://example.test/functions/v1/oauth-userinfo", {
    method,
    headers: {
      Authorization: "Bearer access-token",
    },
  });
}

Deno.test(
  "oauth-userinfo returns scope-shaped profile, email, and subscription data",
  async () => {
    const { deps } = makeDependencies({
      "auth:admin:getUserById": {
        data: {
          user: {
            id: "user-1",
            email: "owner@example.test",
            email_confirmed_at: "2026-04-01T12:00:00.000Z",
            raw_user_meta_data: {
              full_name: "Avery Bloom",
              avatar_url: "https://cdn.example.test/auth-avatar.png",
            },
          },
        },
        error: null,
      },
      "users:select": {
        data: {
          full_name: "Avery Public",
          name: "Avery",
        },
        error: null,
      },
      "company_profiles:select": {
        data: {
          company_name: "Avery Garden Center",
          feature_flags: {
            company_logo_url: "https://cdn.example.test/company-logo.png",
          },
        },
        error: null,
      },
      "subscriptions:select": {
        data: [
          {
            plan: "bloom",
            tier: "bloom",
            end_date: "2026-05-27",
            deleted_at: null,
            max_connections: 5,
            created_at: "2026-04-27T12:00:00.000Z",
          },
        ],
        error: null,
      },
      "plan_definitions:select": {
        data: {
          max_products: 1000,
        },
        error: null,
      },
    });

    const response = await handleOAuthUserinfo(authorizedRequest(), deps);

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Cache-Control"), "no-store");
    assertEquals(await response.json(), {
      sub: "user-1",
      name: "Avery Bloom",
      picture: "https://cdn.example.test/company-logo.png",
      company_name: "Avery Garden Center",
      email: "owner@example.test",
      email_verified: true,
      subscription_plan: "bloom",
      subscription_status: "active",
      subscription_expires_at: "2026-05-27T00:00:00.000Z",
      subscription_features: {
        max_sites: 5,
        max_products: 1000,
      },
    });
  },
);

Deno.test(
  "oauth-userinfo omits claims outside the granted scopes and accepts POST",
  async () => {
    const { deps } = makeDependencies(
      {
        "auth:admin:getUserById": {
          data: {
            user: {
              id: "user-1",
              email: "owner@example.test",
              email_confirmed_at: "2026-04-01T12:00:00.000Z",
              raw_user_meta_data: {
                full_name: "Avery Bloom",
              },
            },
          },
          error: null,
        },
        "users:select": { data: null, error: null },
        "company_profiles:select": { data: null, error: null },
        "subscriptions:select": { data: [], error: null },
      },
      {
        verifyAccessToken: () =>
          Promise.resolve({
            ...VERIFIED_TOKEN,
            scope: "openid email",
          }),
      },
    );

    const response = await handleOAuthUserinfo(authorizedRequest("POST"), deps);

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      sub: "user-1",
      email: "owner@example.test",
      email_verified: true,
    });
  },
);

Deno.test("oauth-userinfo rejects missing bearer tokens", async () => {
  const { deps } = makeDependencies({});

  const response = await handleOAuthUserinfo(
    new Request("https://example.test/functions/v1/oauth-userinfo"),
    deps,
  );

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("WWW-Authenticate"), "Bearer");
  assertEquals(await response.json(), { error: "invalid_token" });
});

Deno.test(
  "oauth-userinfo returns invalid_token for failed access token verification",
  async () => {
    const { deps } = makeDependencies(
      {},
      {
        verifyAccessToken: () => Promise.reject(new Error("invalid token")),
      },
    );

    const response = await handleOAuthUserinfo(authorizedRequest(), deps);

    assertEquals(response.status, 401);
    assertEquals(
      response.headers.get("WWW-Authenticate"),
      'Bearer error="invalid_token"',
    );
    assertEquals(await response.json(), { error: "invalid_token" });
  },
);

Deno.test("oauth-userinfo rejects client_credentials tokens", async () => {
  const { deps } = makeDependencies(
    {},
    {
      verifyAccessToken: () =>
        Promise.resolve({
          ...VERIFIED_TOKEN,
          scope: "subscription:read",
          grant_type: "client_credentials",
          sub: "bloomsuite-cms-m2m",
          aud: "https://bloomsuite.app",
        }),
    },
  );

  const response = await handleOAuthUserinfo(authorizedRequest(), deps);

  assertEquals(response.status, 403);
  assertEquals(
    response.headers.get("WWW-Authenticate"),
    'Bearer error="insufficient_scope", scope="openid"',
  );
  assertEquals(await response.json(), { error: "insufficient_scope" });
});
