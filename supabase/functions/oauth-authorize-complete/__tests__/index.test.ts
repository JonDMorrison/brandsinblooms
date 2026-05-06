import { assertEquals } from "@std/assert";

import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import {
  handleOAuthAuthorizeComplete,
  type OAuthAuthorizeCompleteDependencies,
} from "../index.ts";

const requestClaims = {
  iss: "https://bloomsuite.app",
  aud: "oauth-authorize-complete",
  exp: Math.floor(Date.now() / 1000) + 300,
  request_type: "oauth_authorize_request",
  client_id: "bloomsuite-cms",
  redirect_uri: "http://localhost:3000/api/auth/crm/callback",
  scope: "openid profile email",
  state: "client-state",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
};

const signingKeyRow = {
  kid: "kid-1",
  kty: "RSA",
  alg: "RS256",
  public_key_jwk: {
    kid: "kid-1",
    kty: "RSA",
    alg: "RS256",
    use: "sig",
    n: "sXchv9wtnu5A1Ih7oq8d4urjTj0hTuVb2e1sGTcJdqBNgso7uCW9b4vZkjG1XkqI77QR2y1Z9y5KrJ2VqcUwNw",
    e: "AQAB",
  },
};

function makeRequest(body: Record<string, unknown> = {}) {
  return jsonRequest(
    "https://auth.example.test/functions/v1/oauth-authorize-complete",
    {
      request_jwt: "request.jwt.value",
      access_token: "access-token",
      ...body,
    },
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
        OAUTH_ISSUER: "https://bloomsuite.app",
        OAUTH_AUTHORIZATION_CODE_TTL: "120",
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
      generateAuthorizationCode: () => "plain-authorization-code",
      getJwtKid: () => "kid-1",
      hashToken: async () => "hashed-authorization-code",
      now: () => new Date("2026-04-27T15:00:00.000Z"),
      normalizePublicJwk: (row) => row.public_key_jwk as never,
      verifyJwt: async () => requestClaims,
    } satisfies OAuthAuthorizeCompleteDependencies,
  };
}

Deno.test(
  "oauth-authorize-complete inserts a hashed code and returns the redirect URL",
  async () => {
    const { deps, recorder } = makeDependencies({
      "oauth_signing_keys:select": { data: signingKeyRow, error: null },
      "auth:getUser": { data: { user: { id: "user-id-1" } }, error: null },
      "oauth_authorization_codes:insert": { data: null, error: null },
    });

    const response = await handleOAuthAuthorizeComplete(makeRequest(), deps);

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      redirectUrl:
        "http://localhost:3000/api/auth/crm/callback?code=plain-authorization-code&state=client-state",
    });

    const insert = recorder.find(
      (entry) =>
        entry.table === "oauth_authorization_codes" &&
        entry.operation === "insert",
    );
    assertEquals(insert?.payload, {
      code: "hashed-authorization-code",
      client_id: "bloomsuite-cms",
      user_id: "user-id-1",
      redirect_uri: "http://localhost:3000/api/auth/crm/callback",
      scope: "openid profile email",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      expires_at: "2026-04-27T15:02:00.000Z",
    });
  },
);

Deno.test("oauth-authorize-complete rejects missing request data", async () => {
  const { deps } = makeDependencies({});

  const response = await handleOAuthAuthorizeComplete(
    makeRequest({ request_jwt: "" }),
    deps,
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_request" });
});

Deno.test("oauth-authorize-complete rejects unknown signing keys", async () => {
  const { deps } = makeDependencies({
    "oauth_signing_keys:select": { data: null, error: null },
  });

  const response = await handleOAuthAuthorizeComplete(makeRequest(), deps);

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "invalid_request" });
});

Deno.test(
  "oauth-authorize-complete rejects invalid Supabase access tokens",
  async () => {
    const { deps } = makeDependencies({
      "oauth_signing_keys:select": { data: signingKeyRow, error: null },
      "auth:getUser": { data: { user: null }, error: { message: "bad jwt" } },
    });

    const response = await handleOAuthAuthorizeComplete(makeRequest(), deps);

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "invalid_token" });
  },
);

Deno.test(
  "oauth-authorize-complete returns server_error for missing server configuration",
  async () => {
    const { deps } = makeDependencies({});

    const response = await handleOAuthAuthorizeComplete(makeRequest(), {
      ...deps,
      envGet: makeEnv({}),
    });

    assertEquals(response.status, 500);
    assertEquals(await response.json(), { error: "server_error" });
  },
);

Deno.test(
  "oauth-authorize-complete handles CORS preflight requests",
  async () => {
    const { deps } = makeDependencies({});
    const response = await handleOAuthAuthorizeComplete(
      new Request(
        "https://auth.example.test/functions/v1/oauth-authorize-complete",
        {
          method: "OPTIONS",
        },
      ),
      deps,
    );

    assertEquals(response.status, 204);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
    assertEquals(
      response.headers.get("Access-Control-Allow-Methods"),
      "POST, OPTIONS",
    );
  },
);
