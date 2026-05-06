import { assertEquals } from "@std/assert";

import { handleOAuthDiscovery } from "../index.ts";
import { makeEnv } from "../../_shared/testing/testHarness.ts";

Deno.test(
  "oauth-discovery returns the public OIDC metadata document with cache headers",
  async () => {
    const response = await handleOAuthDiscovery(
      new Request("https://example.test/functions/v1/oauth-discovery"),
      {
        envGet: makeEnv({
          OAUTH_ISSUER: "https://bloomsuite.app",
          SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(response.headers.get("Cache-Control"), "public, max-age=3600");
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");

    const body = await response.json();
    assertEquals(body.issuer, "https://bloomsuite.app");
    assertEquals(
      body.authorization_endpoint,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-authorize-init",
    );
    assertEquals(
      body.token_endpoint,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-token",
    );
    assertEquals(
      body.userinfo_endpoint,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-userinfo",
    );
    assertEquals(
      body.revocation_endpoint,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-revoke",
    );
    assertEquals(
      body.jwks_uri,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-jwks",
    );
    assertEquals(body.response_types_supported, ["code"]);
    assertEquals(body.grant_types_supported, [
      "authorization_code",
      "refresh_token",
      "client_credentials",
    ]);
    assertEquals(body.id_token_signing_alg_values_supported, ["RS256"]);

    new URL(body.authorization_endpoint);
    new URL(body.token_endpoint);
    new URL(body.userinfo_endpoint);
    new URL(body.revocation_endpoint);
    new URL(body.jwks_uri);
  },
);

Deno.test("oauth-discovery handles CORS preflight requests", async () => {
  const response = await handleOAuthDiscovery(
    new Request("https://example.test/functions/v1/oauth-discovery", {
      method: "OPTIONS",
    }),
    {
      envGet: makeEnv({
        OAUTH_ISSUER: "https://bloomsuite.app",
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      }),
    },
  );

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    response.headers.get("Access-Control-Allow-Methods"),
    "GET, OPTIONS",
  );
});

Deno.test(
  "oauth-discovery returns a generic 500 when required env vars are missing",
  async () => {
    const response = await handleOAuthDiscovery(
      new Request("https://example.test/functions/v1/oauth-discovery"),
      {
        envGet: makeEnv({
          SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        }),
      },
    );

    assertEquals(response.status, 500);
    assertEquals(await response.json(), { error: "Internal server error" });
  },
);

Deno.test("oauth-discovery rejects unsupported methods", async () => {
  const response = await handleOAuthDiscovery(
    new Request("https://example.test/functions/v1/oauth-discovery", {
      method: "POST",
    }),
    {
      envGet: makeEnv({
        OAUTH_ISSUER: "https://bloomsuite.app",
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      }),
    },
  );

  assertEquals(response.status, 405);
  assertEquals(response.headers.get("Allow"), "GET, OPTIONS");
});
