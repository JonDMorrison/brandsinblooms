import { assertEquals } from "@std/assert";
import * as oidcClient from "jsr:@panva/openid-client@6.8.4";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
} from "npm:jose@6.2.2";

import { signJWT } from "../../_shared/oauth.ts";
import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";
import { handleOAuthJwks } from "../../oauth-jwks/index.ts";
import { handleOAuthDiscovery } from "../index.ts";

Deno.test(
  "openid-client can discover the authorization server and validate a JWT against the discovered JWKS",
  async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
      extractable: true,
    });
    const kid = "kid-1";
    const publicJwk = await exportJWK(publicKey);

    const { client } = createMockSupabaseClient({
      "oauth_signing_keys:select": {
        data: [
          {
            kid,
            kty: "RSA",
            alg: "RS256",
            created_at: "2026-04-27T12:00:00.000Z",
            public_key_jwk: {
              ...publicJwk,
              kid,
              kty: "RSA",
              alg: "RS256",
              use: "sig",
            },
          },
        ],
        error: null,
      },
    });

    const envGet = makeEnv({
      OAUTH_ISSUER: "https://bloomsuite.app",
      SUPABASE_URL: "https://udldmkqwnxhdeztyqcau.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    const customFetch = async (
      input: Request | URL | string,
      init?: {
        method?: string;
        headers?: HeadersInit;
        body?: unknown;
      },
    ): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : init?.method;

      if (url === "https://bloomsuite.app/.well-known/openid-configuration") {
        return await handleOAuthDiscovery(
          new Request(
            "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-discovery",
            { method, headers: init?.headers },
          ),
          { envGet },
        );
      }

      if (
        url ===
        "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-jwks"
      ) {
        return await handleOAuthJwks(
          new Request(url, { method, headers: init?.headers }),
          {
            createClient: () => client as never,
            envGet,
          },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const configuration = await oidcClient.discovery(
      new URL("https://bloomsuite.app/.well-known/openid-configuration"),
      "bloomsuite-cms",
      "client-secret",
      undefined,
      { [oidcClient.customFetch]: customFetch as never },
    );

    assertEquals(
      configuration.serverMetadata().issuer,
      "https://bloomsuite.app",
    );
    assertEquals(
      configuration.serverMetadata().jwks_uri,
      "https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/oauth-jwks",
    );

    const jwksResponse = await customFetch(
      configuration.serverMetadata().jwks_uri!,
    );
    assertEquals(jwksResponse.status, 200);

    const localJwks = createLocalJWKSet(await jwksResponse.json());
    const jwt = await signJWT(
      {
        sub: "crm-user-id",
        aud: "bloomsuite-cms",
        iss: "https://bloomsuite.app",
        exp: Math.floor(Date.now() / 1000) + 900,
      },
      privateKey,
      kid,
    );

    const { protectedHeader, payload } = await jwtVerify(jwt, localJwks, {
      audience: "bloomsuite-cms",
      issuer: "https://bloomsuite.app",
    });

    assertEquals(protectedHeader.kid, kid);
    assertEquals(payload.sub, "crm-user-id");
  },
);
