import { assertEquals } from "@std/assert";

import { handleOAuthJwks } from "../index.ts";
import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";

Deno.test(
  "oauth-jwks returns active RSA signing keys with cache headers",
  async () => {
    const { client, recorder } = createMockSupabaseClient({
      "oauth_signing_keys:select": {
        data: [
          {
            kid: "kid-1",
            kty: "RSA",
            alg: "RS256",
            created_at: "2026-04-27T12:00:00.000Z",
            public_key_jwk: {
              kty: "RSA",
              alg: "RS256",
              n: "modulus-base64url",
              e: "AQAB",
            },
          },
        ],
        error: null,
      },
    });

    const response = await handleOAuthJwks(
      new Request("https://example.test/functions/v1/oauth-jwks"),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(response.headers.get("Cache-Control"), "public, max-age=3600");
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
    assertEquals(await response.json(), {
      keys: [
        {
          kty: "RSA",
          kid: "kid-1",
          alg: "RS256",
          use: "sig",
          n: "modulus-base64url",
          e: "AQAB",
        },
      ],
    });

    assertEquals(recorder.length, 1);
    assertEquals(recorder[0].table, "oauth_signing_keys");
    assertEquals(recorder[0].filters, [
      { type: "eq", column: "is_active", value: true },
      { type: "order", column: "created_at", value: { ascending: false } },
    ]);
  },
);

Deno.test(
  "oauth-jwks returns an empty JWKS when no active signing keys exist",
  async () => {
    const { client } = createMockSupabaseClient({
      "oauth_signing_keys:select": { data: [], error: null },
    });

    const response = await handleOAuthJwks(
      new Request("https://example.test/functions/v1/oauth-jwks"),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
      },
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { keys: [] });
  },
);

Deno.test("oauth-jwks supports OKP public keys", async () => {
  const { client } = createMockSupabaseClient({
    "oauth_signing_keys:select": {
      data: [
        {
          kid: "kid-okp",
          kty: "OKP",
          alg: "EdDSA",
          created_at: "2026-04-27T12:00:00.000Z",
          public_key_jwk: {
            crv: "Ed25519",
            x: "public-x-base64url",
          },
        },
      ],
      error: null,
    },
  });

  const response = await handleOAuthJwks(
    new Request("https://example.test/functions/v1/oauth-jwks"),
    {
      createClient: () => client as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    keys: [
      {
        kty: "OKP",
        kid: "kid-okp",
        alg: "EdDSA",
        use: "sig",
        crv: "Ed25519",
        x: "public-x-base64url",
      },
    ],
  });
});

Deno.test(
  "oauth-jwks returns a generic 500 when the database query fails",
  async () => {
    const { client } = createMockSupabaseClient({
      "oauth_signing_keys:select": {
        data: null,
        error: { message: "permission denied" },
      },
    });

    const response = await handleOAuthJwks(
      new Request("https://example.test/functions/v1/oauth-jwks"),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        }),
      },
    );

    assertEquals(response.status, 500);
    assertEquals(await response.json(), { error: "Internal server error" });
  },
);

Deno.test("oauth-jwks handles CORS preflight requests", async () => {
  const response = await handleOAuthJwks(
    new Request("https://example.test/functions/v1/oauth-jwks", {
      method: "OPTIONS",
    }),
    {
      createClient: createMockSupabaseClient({}).client as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
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

Deno.test("oauth-jwks rejects unsupported methods", async () => {
  const response = await handleOAuthJwks(
    new Request("https://example.test/functions/v1/oauth-jwks", {
      method: "POST",
    }),
    {
      createClient: createMockSupabaseClient({}).client as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    },
  );

  assertEquals(response.status, 405);
  assertEquals(response.headers.get("Allow"), "GET, OPTIONS");
});
