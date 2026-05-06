import { assertEquals, assertRejects } from "@std/assert";
import { exportJWK, generateKeyPair } from "jose";

import { signJWT } from "../oauth.ts";
import { createMockSupabaseClient, makeEnv } from "../testing/testHarness.ts";
import {
  verifyAccessToken,
  type VerifyAccessTokenDependencies,
} from "../verifyAccessToken.ts";

const ISSUER = "https://bloomsuite.app";

async function makeDependencies(kid: string, publicKey: CryptoKey) {
  const publicJwk = await exportJWK(publicKey);
  const { client } = createMockSupabaseClient({
    "oauth_signing_keys:select": {
      data: {
        kid,
        alg: "RS256",
        public_key_jwk: {
          ...publicJwk,
          kid,
          alg: "RS256",
          use: "sig",
        },
        is_active: true,
      },
      error: null,
    },
  });

  return {
    createClient: () => client as never,
    envGet: makeEnv({
      OAUTH_ISSUER: ISSUER,
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    }),
  } satisfies VerifyAccessTokenDependencies;
}

Deno.test(
  "verifyAccessToken validates a signed OAuth access token",
  async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
      extractable: true,
    });
    const kid = "kid-verify-1";
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
      {
        sub: "user-1",
        scope: "openid email",
        client_id: "bloomsuite-cms",
        grant_type: "authorization_code",
        iss: ISSUER,
        aud: "bloomsuite-cms",
        iat: now,
        exp: now + 900,
      },
      privateKey,
      kid,
    );

    const payload = await verifyAccessToken(
      token,
      await makeDependencies(kid, publicKey),
    );

    assertEquals(payload.sub, "user-1");
    assertEquals(payload.scope, "openid email");
    assertEquals(payload.client_id, "bloomsuite-cms");
    assertEquals(payload.grant_type, "authorization_code");
    assertEquals(payload.iss, ISSUER);
    assertEquals(payload.aud, "bloomsuite-cms");
  },
);

Deno.test(
  "verifyAccessToken rejects access tokens with the wrong issuer",
  async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
      extractable: true,
    });
    const kid = "kid-verify-2";
    const deps = await makeDependencies(kid, publicKey);
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
      {
        sub: "user-1",
        scope: "openid profile",
        client_id: "bloomsuite-cms",
        iss: "https://invalid.example.test",
        aud: "bloomsuite-cms",
        iat: now,
        exp: now + 900,
      },
      privateKey,
      kid,
    );

    await assertRejects(() => verifyAccessToken(token, deps));
  },
);
