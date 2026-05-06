import { assertEquals, assertStringIncludes } from "@std/assert";

import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import { handleOAuthAuthorizeInit } from "../index.ts";

const VALID_QUERY = new URLSearchParams({
  response_type: "code",
  client_id: "bloomsuite-cms",
  redirect_uri: "http://localhost:3000/api/auth/crm/callback",
  scope: "openid profile email",
  state: "client-state",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
});

function makeRequest(query: URLSearchParams = VALID_QUERY): Request {
  return new Request(
    `https://auth.example.test/functions/v1/oauth-authorize-init?${query.toString()}`,
  );
}

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
) {
  const { client, recorder } = createMockSupabaseClient(seededResponses);

  return {
    recorder,
    deps: {
      createClient: () => client as never,
      envGet: makeEnv({
        APP_ORIGIN: "https://app.example.test",
        OAUTH_ISSUER: "https://bloomsuite.app",
        OAUTH_JWT_KEY_ID: "kid-1",
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
      parsePrivateKey: async () => ({}) as CryptoKey,
      randomUUID: () => "request-id-1",
      signJwt: async () => "signed-request-jwt",
    },
  };
}

const activeClient = {
  client_id: "bloomsuite-cms",
  client_name: "BloomSuite CMS",
  redirect_uris: ["http://localhost:3000/api/auth/crm/callback"],
  allowed_scopes: ["openid", "profile", "email", "subscription"],
  is_active: true,
  is_first_party: true,
};

Deno.test(
  "oauth-authorize-init redirects valid requests to the SPA authorize page",
  async () => {
    const { deps, recorder } = makeDependencies({
      "oauth_clients:select": { data: activeClient, error: null },
    });

    const response = await handleOAuthAuthorizeInit(makeRequest(), deps);

    assertEquals(response.status, 302);
    const location = response.headers.get("Location");
    assertEquals(
      location,
      "https://app.example.test/oauth/authorize?request_jwt=signed-request-jwt&request_id=request-id-1",
    );
    assertEquals(recorder[0].table, "oauth_clients");
    assertEquals(recorder[0].filters, [
      { type: "eq", column: "client_id", value: "bloomsuite-cms" },
    ]);
  },
);

Deno.test(
  "oauth-authorize-init returns an error page for an unregistered client",
  async () => {
    const { deps } = makeDependencies({
      "oauth_clients:select": { data: null, error: null },
    });

    const response = await handleOAuthAuthorizeInit(makeRequest(), deps);

    assertEquals(response.status, 400);
    assertEquals(response.headers.get("Location"), null);
    assertStringIncludes(await response.text(), "Authorization request failed");
  },
);

Deno.test(
  "oauth-authorize-init returns an error page for an invalid redirect URI",
  async () => {
    const { deps } = makeDependencies({
      "oauth_clients:select": { data: activeClient, error: null },
    });
    const query = new URLSearchParams(VALID_QUERY);
    query.set("redirect_uri", "https://attacker.example/callback");

    const response = await handleOAuthAuthorizeInit(makeRequest(query), deps);

    assertEquals(response.status, 400);
    assertEquals(response.headers.get("Location"), null);
  },
);

Deno.test(
  "oauth-authorize-init redirects invalid scope errors to a valid redirect URI",
  async () => {
    const { deps } = makeDependencies({
      "oauth_clients:select": { data: activeClient, error: null },
    });
    const query = new URLSearchParams(VALID_QUERY);
    query.set("scope", "openid admin");

    const response = await handleOAuthAuthorizeInit(makeRequest(query), deps);

    assertEquals(response.status, 302);
    const location = new URL(response.headers.get("Location")!);
    assertEquals(
      location.origin + location.pathname,
      activeClient.redirect_uris[0],
    );
    assertEquals(location.searchParams.get("error"), "invalid_scope");
    assertEquals(location.searchParams.get("state"), "client-state");
  },
);

Deno.test("oauth-authorize-init handles CORS preflight requests", async () => {
  const { deps } = makeDependencies({});
  const response = await handleOAuthAuthorizeInit(
    new Request("https://auth.example.test/functions/v1/oauth-authorize-init", {
      method: "OPTIONS",
    }),
    deps,
  );

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    response.headers.get("Access-Control-Allow-Methods"),
    "GET, OPTIONS",
  );
});
