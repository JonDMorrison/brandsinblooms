import { assertEquals } from "@std/assert";
import bcrypt from "bcryptjs";

import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import {
  hashToken,
  signJWT,
  validateScopes,
  verifyPKCE,
} from "../../_shared/oauth.ts";
import { handleOAuthRevoke, type OAuthRevokeDependencies } from "../index.ts";
import {
  handleOAuthToken,
  type OAuthTokenDependencies,
} from "../../oauth-token/index.ts";

const CLIENT_ID = "bloomsuite-cms";
const CLIENT_SECRET = "cms-secret";

function clientSecretHash(secret = CLIENT_SECRET): string {
  return bcrypt.hashSync(secret, 4);
}

function activeClient() {
  return {
    client_id: CLIENT_ID,
    client_secret_hash: clientSecretHash(),
    allowed_scopes: ["openid", "profile", "email", "subscription"],
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    is_active: true,
  };
}

function basicAuthHeader(clientId = CLIENT_ID, secret = CLIENT_SECRET): string {
  return `Basic ${btoa(
    `${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`,
  )}`;
}

function makeDependencies(
  seededResponses: Parameters<typeof createMockSupabaseClient>[0],
  overrides: Partial<OAuthRevokeDependencies> = {},
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
      hashToken,
      now: () => new Date("2026-04-27T16:00:00.000Z"),
      verifyClientSecret: (secret, hash) => bcrypt.compareSync(secret, hash),
      ...overrides,
    } satisfies OAuthRevokeDependencies,
  };
}

function findRecord(
  recorder: ReturnType<typeof createMockSupabaseClient>["recorder"],
  table: string,
  operation: "select" | "insert" | "update" | "upsert" | "delete" | "rpc",
) {
  return recorder.find(
    (entry) => entry.table === table && entry.operation === operation,
  );
}

Deno.test("oauth-revoke revokes the entire refresh token family", async () => {
  const { deps, recorder } = makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
    "oauth_refresh_tokens:select": {
      data: {
        client_id: CLIENT_ID,
        family_id: "family-1",
      },
      error: null,
    },
    "oauth_refresh_tokens:update": { data: null, error: null },
  });

  const response = await handleOAuthRevoke(
    new Request("https://example.test/functions/v1/oauth-revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        token: "refresh-token-1",
        token_type_hint: "refresh_token",
      }),
    }),
    deps,
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  const update = findRecord(recorder, "oauth_refresh_tokens", "update");
  assertEquals(update?.filters, [
    { type: "eq", column: "family_id", value: "family-1" },
    { type: "is", column: "revoked_at", value: null },
  ]);
});

Deno.test(
  "oauth-revoke returns 200 for access token hints without refresh lookup",
  async () => {
    const { deps, recorder } = makeDependencies({
      "oauth_clients:select": { data: activeClient(), error: null },
    });

    const response = await handleOAuthRevoke(
      jsonRequest(
        "https://example.test/functions/v1/oauth-revoke",
        {
          token: "jwt-access-token",
          token_type_hint: "access_token",
        },
        {
          headers: {
            Authorization: basicAuthHeader(),
          },
        },
      ),
      deps,
    );

    assertEquals(response.status, 200);
    assertEquals(
      findRecord(recorder, "oauth_refresh_tokens", "select"),
      undefined,
    );
  },
);

Deno.test("oauth-revoke returns 200 for unknown refresh tokens", async () => {
  const { deps } = makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
    "oauth_refresh_tokens:select": { data: null, error: null },
  });

  const response = await handleOAuthRevoke(
    jsonRequest(
      "https://example.test/functions/v1/oauth-revoke",
      {
        token: "missing-refresh-token",
      },
      {
        headers: {
          Authorization: basicAuthHeader(),
        },
      },
    ),
    deps,
  );

  assertEquals(response.status, 200);
});

Deno.test("oauth-revoke rejects invalid client credentials", async () => {
  const { deps } = makeDependencies({
    "oauth_clients:select": { data: activeClient(), error: null },
  });

  const response = await handleOAuthRevoke(
    jsonRequest(
      "https://example.test/functions/v1/oauth-revoke",
      { token: "refresh-token-1" },
      {
        headers: {
          Authorization: basicAuthHeader(CLIENT_ID, "wrong-secret"),
        },
      },
    ),
    deps,
  );

  assertEquals(response.status, 401);
  assertEquals(
    response.headers.get("WWW-Authenticate"),
    'Basic realm="oauth-revoke"',
  );
  assertEquals(await response.json(), { error: "invalid_client" });
});

function createStatefulSupabaseClient(refreshTokenHashes: {
  revokedTokenHash: string;
  siblingTokenHash: string;
}) {
  const oauthClient = {
    client_id: CLIENT_ID,
    client_secret_hash: clientSecretHash(),
    allowed_scopes: ["openid", "profile", "email", "subscription"],
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    is_active: true,
  };

  const refreshTokens = [
    {
      id: "refresh-a",
      token_hash: refreshTokenHashes.revokedTokenHash,
      client_id: CLIENT_ID,
      user_id: "user-1",
      scope: "openid profile email subscription",
      family_id: "family-1",
      expires_at: "2026-05-27T16:00:00.000Z",
      revoked_at: null as string | null,
    },
    {
      id: "refresh-b",
      token_hash: refreshTokenHashes.siblingTokenHash,
      client_id: CLIENT_ID,
      user_id: "user-1",
      scope: "openid profile email subscription",
      family_id: "family-1",
      expires_at: "2026-05-27T16:00:00.000Z",
      revoked_at: null as string | null,
    },
  ];

  return {
    from(table: string) {
      return {
        select(_columns?: string) {
          const filters: Array<{
            type: string;
            column?: string;
            value?: unknown;
          }> = [];
          const query = {
            eq(column: string, value: unknown) {
              filters.push({ type: "eq", column, value });
              return query;
            },
            is(column: string, value: unknown) {
              filters.push({ type: "is", column, value });
              return query;
            },
            maybeSingle<T = unknown>() {
              if (table === "oauth_clients") {
                const clientId = filters.find(
                  (filter) => filter.column === "client_id",
                )?.value;
                return Promise.resolve({
                  data: clientId === CLIENT_ID ? (oauthClient as T) : null,
                  error: null,
                });
              }

              if (table === "oauth_refresh_tokens") {
                const tokenHash = filters.find(
                  (filter) => filter.column === "token_hash",
                )?.value;
                const token =
                  refreshTokens.find(
                    (candidate) => candidate.token_hash === tokenHash,
                  ) ?? null;
                return Promise.resolve({
                  data: token as T | null,
                  error: null,
                });
              }

              return Promise.resolve({ data: null, error: null });
            },
          };
          return query;
        },
        update(payload: unknown) {
          const filters: Array<{
            type: string;
            column?: string;
            value?: unknown;
          }> = [];
          const query = {
            eq(column: string, value: unknown) {
              filters.push({ type: "eq", column, value });
              return query;
            },
            is(column: string, value: unknown) {
              filters.push({ type: "is", column, value });
              return query;
            },
            select(_columns?: string) {
              return query;
            },
            maybeSingle<T = unknown>() {
              const id = filters.find(
                (filter) => filter.column === "id",
              )?.value;
              const requireNullRevokedAt = filters.some(
                (filter) =>
                  filter.type === "is" &&
                  filter.column === "revoked_at" &&
                  filter.value === null,
              );
              const token = refreshTokens.find(
                (candidate) =>
                  candidate.id === id &&
                  (!requireNullRevokedAt || candidate.revoked_at === null),
              );
              if (
                token &&
                typeof payload === "object" &&
                payload !== null &&
                "revoked_at" in payload
              ) {
                token.revoked_at = payload.revoked_at as string;
              }
              return Promise.resolve({
                data: token ? ({ id: token.id } as T) : null,
                error: null,
              });
            },
            then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
              onfulfilled?:
                | ((value: {
                    data: unknown;
                    error: null;
                  }) => TResult1 | PromiseLike<TResult1>)
                | null,
              onrejected?:
                | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
                | null,
            ) {
              const familyId = filters.find(
                (filter) => filter.column === "family_id",
              )?.value;
              const requireNullRevokedAt = filters.some(
                (filter) =>
                  filter.type === "is" &&
                  filter.column === "revoked_at" &&
                  filter.value === null,
              );
              if (
                familyId &&
                typeof payload === "object" &&
                payload !== null &&
                "revoked_at" in payload
              ) {
                for (const token of refreshTokens) {
                  if (
                    token.family_id === familyId &&
                    (!requireNullRevokedAt || token.revoked_at === null)
                  ) {
                    token.revoked_at = payload.revoked_at as string;
                  }
                }
              }

              return Promise.resolve({ data: null, error: null }).then(
                onfulfilled,
                onrejected,
              );
            },
          };
          return query;
        },
      };
    },
  };
}

Deno.test(
  "oauth-revoke invalidates sibling refresh tokens in the same family",
  async () => {
    const revokedTokenHash = await hashToken("refresh-token-a");
    const siblingTokenHash = await hashToken("refresh-token-b");
    const statefulClient = createStatefulSupabaseClient({
      revokedTokenHash,
      siblingTokenHash,
    });

    const revokeDeps = {
      createClient: () => statefulClient as never,
      envGet: makeEnv({
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
      hashToken,
      now: () => new Date("2026-04-27T16:00:00.000Z"),
      verifyClientSecret: (secret: string, hash: string) =>
        bcrypt.compareSync(secret, hash),
    } satisfies OAuthRevokeDependencies;

    const tokenDeps = {
      createClient: () => statefulClient as never,
      envGet: makeEnv({
        OAUTH_ISSUER: "https://bloomsuite.app",
        OAUTH_JWT_KEY_ID: "kid-1",
        OAUTH_ACCESS_TOKEN_TTL: "900",
        OAUTH_REFRESH_TOKEN_TTL: "2592000",
        SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
      generateRefreshToken: () => "unused-refresh-token",
      hashToken,
      now: () => new Date("2026-04-27T16:00:00.000Z"),
      parsePrivateKey: async () => {
        const { privateKey } = await crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["sign", "verify"],
        );
        return privateKey;
      },
      randomUUID: () => "family-1",
      signJwt: signJWT,
      validateScopes,
      verifyClientSecret: (secret, hash) => bcrypt.compareSync(secret, hash),
      verifyPkce: verifyPKCE,
    } satisfies OAuthTokenDependencies;

    const revokeResponse = await handleOAuthRevoke(
      jsonRequest(
        "https://example.test/functions/v1/oauth-revoke",
        { token: "refresh-token-a" },
        { headers: { Authorization: basicAuthHeader() } },
      ),
      revokeDeps,
    );
    assertEquals(revokeResponse.status, 200);

    const refreshResponse = await handleOAuthToken(
      jsonRequest(
        "https://example.test/functions/v1/oauth-token",
        {
          grant_type: "refresh_token",
          refresh_token: "refresh-token-b",
        },
        { headers: { Authorization: basicAuthHeader() } },
      ),
      tokenDeps,
    );

    assertEquals(refreshResponse.status, 400);
    assertEquals(await refreshResponse.json(), { error: "invalid_grant" });
  },
);
