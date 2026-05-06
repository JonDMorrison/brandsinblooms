import { assert, assertEquals, assertMatch } from "@std/assert";
import bcrypt from "bcryptjs";
import { generateKeyPair, jwtVerify } from "jose";

import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
  type QueryRecorderEntry,
} from "../../_shared/testing/testHarness.ts";
import {
  generateRefreshToken,
  hashToken,
  signJWT,
  validateScopes,
  verifyPKCE,
} from "../../_shared/oauth.ts";
import { handleOAuthToken, type OAuthTokenDependencies } from "../index.ts";

const ISSUER = "https://bloomsuite.app";
const CLIENT_ID = "bloomsuite-cms";
const CLIENT_SECRET = "cms-secret";
const REDIRECT_URI = "http://localhost:3000/api/auth/crm/callback";
const NOW = new Date("2026-04-27T16:00:00.000Z");
const CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

let keyPairPromise: ReturnType<typeof generateKeyPair> | null = null;

function getKeyPair() {
  keyPairPromise ??= generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  return keyPairPromise;
}

function clientSecretHash(secret = CLIENT_SECRET): string {
  return bcrypt.hashSync(secret, 4);
}

function activeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: clientSecretHash(),
    allowed_scopes: [
      "openid",
      "profile",
      "email",
      "subscription",
      "subscription:read",
      "user:provision",
    ],
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    is_active: true,
    is_first_party: true,
    ...overrides,
  };
}

function authCodeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "code-row-1",
    client_id: CLIENT_ID,
    user_id: "user-1",
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email subscription",
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
    expires_at: "2026-04-27T16:05:00.000Z",
    consumed_at: null,
    ...overrides,
  };
}

function refreshTokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "refresh-row-1",
    token_hash: "stored-refresh-hash",
    client_id: CLIENT_ID,
    user_id: "user-1",
    scope: "openid profile email subscription",
    family_id: "family-1",
    expires_at: "2026-05-27T16:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

function userContextResponses() {
  return {
    "auth:admin:getUserById": {
      data: {
        user: {
          id: "user-1",
          email: "owner@example.test",
          email_confirmed_at: "2026-04-01T12:00:00.000Z",
          last_sign_in_at: "2026-04-27T15:30:00.000Z",
          raw_user_meta_data: {
            avatar_url: "https://cdn.example.test/avatar.png",
          },
        },
      },
      error: null,
    },
    "users:select": {
      data: {
        tenant_id: "tenant-1",
        full_name: "Avery Bloom",
        name: "Avery",
        email: "avery.public@example.test",
        last_sign_in_at: "2026-04-27T15:15:00.000Z",
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
          billing_interval: "monthly",
          created_at: "2026-04-27T12:00:00.000Z",
        },
      ],
      error: null,
    },
  };
}

async function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  overrides: Partial<OAuthTokenDependencies> = {},
) {
  const { privateKey, publicKey } = await getKeyPair();
  const { client, recorder } = createMockSupabaseClient(seededResponses);
  const refreshTokens = ["refresh-token-1", "refresh-token-2"];

  const deps = {
    createClient: () => client as never,
    envGet: makeEnv({
      OAUTH_ISSUER: ISSUER,
      OAUTH_JWT_KEY_ID: "kid-1",
      OAUTH_ACCESS_TOKEN_TTL: "900",
      OAUTH_REFRESH_TOKEN_TTL: "2592000",
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
    generateRefreshToken: () => refreshTokens.shift() ?? generateRefreshToken(),
    hashToken,
    now: () => NOW,
    parsePrivateKey: () => Promise.resolve(privateKey),
    randomUUID: () => "family-1",
    signJwt: signJWT,
    validateScopes,
    verifyClientSecret: (secret, hash) => bcrypt.compareSync(secret, hash),
    verifyPkce: verifyPKCE,
    ...overrides,
  } satisfies OAuthTokenDependencies;

  return { deps, publicKey, recorder };
}

function basicAuthHeader(clientId = CLIENT_ID, secret = CLIENT_SECRET): string {
  return `Basic ${btoa(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`,
  )}`;
}

function makeCodeGrantRequest(
  body: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return jsonRequest(
    "https://example.test/functions/v1/oauth-token",
    {
      grant_type: "authorization_code",
      code: "plain-code",
      redirect_uri: REDIRECT_URI,
      code_verifier: CODE_VERIFIER,
      ...body,
    },
    {
      headers: {
        Authorization: basicAuthHeader(),
        ...headers,
      },
    },
  );
}

function findRecord(
  recorder: QueryRecorderEntry[],
  table: string,
  operation: QueryRecorderEntry["operation"],
) {
  return recorder.find(
    (entry) => entry.table === table && entry.operation === operation,
  );
}

Deno.test(
  "oauth-token exchanges authorization codes for JWT, ID, and refresh tokens",
  async () => {
    const { deps, publicKey, recorder } = await makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
      "oauth_authorization_codes:select": { data: authCodeRow(), error: null },
      "oauth_authorization_codes:update": {
        data: { id: "code-row-1" },
        error: null,
      },
      ...userContextResponses(),
      "oauth_refresh_tokens:insert": { data: null, error: null },
    });

    const response = await handleOAuthToken(makeCodeGrantRequest(), deps);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Cache-Control"), "no-store");
    assertEquals(response.headers.get("Pragma"), "no-cache");
    assertEquals(body.token_type, "Bearer");
    assertEquals(body.expires_in, 900);
    assertEquals(body.scope, "openid profile email subscription");
    assertEquals(body.refresh_token, "refresh-token-1");
    assert(typeof body.access_token === "string");
    assert(typeof body.id_token === "string");

    const access = await jwtVerify(body.access_token, publicKey, {
      issuer: ISSUER,
      audience: CLIENT_ID,
      currentDate: NOW,
    });
    assertEquals(access.payload.sub, "user-1");
    assertEquals(access.payload.scope, "openid profile email subscription");
    assertEquals(access.payload.client_id, CLIENT_ID);
    assertEquals(access.payload.grant_type, "authorization_code");
    assertEquals(access.payload.email, "owner@example.test");
    assertEquals(access.payload.name, "Avery Bloom");
    assertEquals(access.payload.picture, "https://cdn.example.test/avatar.png");
    assertEquals(access.payload.subscription_plan, "bloom");
    assertEquals(access.payload.subscription_status, "active");

    const idToken = await jwtVerify(body.id_token, publicKey, {
      issuer: ISSUER,
      audience: CLIENT_ID,
      currentDate: NOW,
    });
    assertEquals(idToken.payload.sub, "user-1");
    assertEquals(idToken.payload.email_verified, true);
    assertEquals(idToken.payload.auth_time, 1777303800);

    const codeUpdate = findRecord(
      recorder,
      "oauth_authorization_codes",
      "update",
    );
    assertEquals(codeUpdate?.payload, { consumed_at: NOW.toISOString() });

    const refreshInsert = findRecord(
      recorder,
      "oauth_refresh_tokens",
      "insert",
    );
    assertEquals(refreshInsert?.payload, {
      token_hash: await hashToken("refresh-token-1"),
      client_id: CLIENT_ID,
      user_id: "user-1",
      scope: "openid profile email subscription",
      family_id: "family-1",
      parent_token_id: null,
      expires_at: "2026-05-27T16:00:00.000Z",
    });
  },
);

Deno.test(
  "oauth-token supports form-urlencoded client_secret_post client credentials",
  async () => {
    const { deps, publicKey, recorder } = await makeDependencies({
      "oauth_clients:select": {
        data: activeClient({
          client_id: "bloomsuite-cms-m2m",
          client_secret_hash: clientSecretHash("m2m-secret"),
          allowed_scopes: ["user:provision", "subscription:read"],
          grant_types: ["client_credentials"],
        }),
        error: null,
      },
    });
    const requestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "bloomsuite-cms-m2m",
      client_secret: "m2m-secret",
      scope: "user:provision subscription:read",
    });

    const response = await handleOAuthToken(
      new Request("https://example.test/functions/v1/oauth-token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: requestBody,
      }),
      deps,
    );
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.refresh_token, undefined);
    assertEquals(body.id_token, undefined);
    assertEquals(body.scope, "user:provision subscription:read");

    const access = await jwtVerify(body.access_token, publicKey, {
      issuer: ISSUER,
      audience: ISSUER,
      currentDate: NOW,
    });
    assertEquals(access.payload.sub, "bloomsuite-cms-m2m");
    assertEquals(access.payload.grant_type, "client_credentials");
    assertEquals(
      findRecord(recorder, "oauth_refresh_tokens", "insert"),
      undefined,
    );
  },
);

Deno.test("oauth-token rejects invalid client credentials", async () => {
  const { deps, recorder } = await makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
  });

  const response = await handleOAuthToken(
    makeCodeGrantRequest(
      {},
      {
        Authorization: basicAuthHeader(CLIENT_ID, "wrong"),
      },
    ),
    deps,
  );

  assertEquals(response.status, 401);
  assertEquals(
    response.headers.get("WWW-Authenticate"),
    'Basic realm="oauth-token"',
  );
  assertEquals(await response.json(), { error: "invalid_client" });
  assertEquals(
    findRecord(recorder, "oauth_authorization_codes", "update"),
    undefined,
  );
});

Deno.test(
  "oauth-token rejects PKCE mismatches without consuming the code",
  async () => {
    const { deps, recorder } = await makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
      "oauth_authorization_codes:select": { data: authCodeRow(), error: null },
    });

    const response = await handleOAuthToken(
      makeCodeGrantRequest({ code_verifier: "wrong-verifier" }),
      deps,
    );

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "invalid_grant" });
    assertEquals(
      findRecord(recorder, "oauth_authorization_codes", "update"),
      undefined,
    );
    assertEquals(
      findRecord(recorder, "oauth_refresh_tokens", "insert"),
      undefined,
    );
  },
);

Deno.test("oauth-token rejects consumed authorization codes", async () => {
  const { deps } = await makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
    "oauth_authorization_codes:select": {
      data: authCodeRow({ consumed_at: "2026-04-27T15:59:00.000Z" }),
      error: null,
    },
  });

  const response = await handleOAuthToken(makeCodeGrantRequest(), deps);

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_grant" });
});

Deno.test("oauth-token rejects redirect URI mismatches", async () => {
  const { deps } = await makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
    "oauth_authorization_codes:select": { data: authCodeRow(), error: null },
  });

  const response = await handleOAuthToken(
    makeCodeGrantRequest({ redirect_uri: "https://attacker.example/callback" }),
    deps,
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_grant" });
});

Deno.test(
  "oauth-token rotates refresh tokens and preserves the token family",
  async () => {
    const { deps, recorder } = await makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
      "oauth_refresh_tokens:select": { data: refreshTokenRow(), error: null },
      "oauth_refresh_tokens:update": {
        data: { id: "refresh-row-1" },
        error: null,
      },
      ...userContextResponses(),
      "oauth_refresh_tokens:insert": { data: null, error: null },
    });

    const response = await handleOAuthToken(
      jsonRequest(
        "https://example.test/functions/v1/oauth-token",
        {
          grant_type: "refresh_token",
          refresh_token: "refresh-token-old",
          scope: "openid email subscription",
        },
        { headers: { Authorization: basicAuthHeader() } },
      ),
      deps,
    );
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.refresh_token, "refresh-token-1");
    assertEquals(body.scope, "openid email subscription");
    const update = findRecord(recorder, "oauth_refresh_tokens", "update");
    assertEquals(update?.filters, [
      { type: "eq", column: "id", value: "refresh-row-1" },
      { type: "is", column: "revoked_at", value: null },
    ]);

    const insert = findRecord(recorder, "oauth_refresh_tokens", "insert");
    assertEquals(insert?.payload, {
      token_hash: await hashToken("refresh-token-1"),
      client_id: CLIENT_ID,
      user_id: "user-1",
      scope: "openid email subscription",
      family_id: "family-1",
      parent_token_id: "refresh-row-1",
      expires_at: "2026-05-27T16:00:00.000Z",
    });
  },
);

Deno.test("oauth-token revokes the refresh token family on reuse", async () => {
  const { deps, recorder } = await makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
    "oauth_refresh_tokens:select": {
      data: refreshTokenRow({ revoked_at: "2026-04-27T15:00:00.000Z" }),
      error: null,
    },
    "oauth_refresh_tokens:update": { data: null, error: null },
  });

  const response = await handleOAuthToken(
    jsonRequest(
      "https://example.test/functions/v1/oauth-token",
      {
        grant_type: "refresh_token",
        refresh_token: "reused-refresh-token",
      },
      { headers: { Authorization: basicAuthHeader() } },
    ),
    deps,
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_grant" });
  const familyRevoke = findRecord(recorder, "oauth_refresh_tokens", "update");
  assertEquals(familyRevoke?.filters, [
    { type: "eq", column: "family_id", value: "family-1" },
    { type: "is", column: "revoked_at", value: null },
  ]);
  assertEquals(
    findRecord(recorder, "oauth_refresh_tokens", "insert"),
    undefined,
  );
});

Deno.test(
  "oauth-token returns RFC OAuth errors for unsupported methods and grants",
  async () => {
    const { deps } = await makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
    });

    const getResponse = await handleOAuthToken(
      new Request("https://example.test/functions/v1/oauth-token"),
      deps,
    );
    assertEquals(getResponse.status, 405);
    assertEquals(getResponse.headers.get("Allow"), "POST, OPTIONS");

    const unsupportedGrant = await handleOAuthToken(
      jsonRequest(
        "https://example.test/functions/v1/oauth-token",
        { grant_type: "password" },
        { headers: { Authorization: basicAuthHeader() } },
      ),
      deps,
    );
    assertEquals(unsupportedGrant.status, 400);
    assertEquals(await unsupportedGrant.json(), {
      error: "unsupported_grant_type",
    });
  },
);

Deno.test(
  "oauth-token hashes incoming opaque token values before lookup",
  async () => {
    const { deps, recorder } = await makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
      "oauth_authorization_codes:select": { data: null, error: null },
    });

    const response = await handleOAuthToken(makeCodeGrantRequest(), deps);

    assertEquals(response.status, 400);
    const select = findRecord(recorder, "oauth_authorization_codes", "select");
    const codeFilter = select?.filters.find(
      (filter) => filter.column === "code",
    );
    assertEquals(codeFilter?.value, await hashToken("plain-code"));
    assertMatch(String(codeFilter?.value), /^[a-f0-9]{64}$/);
  },
);
