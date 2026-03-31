import { assertEquals, assertStringIncludes } from "@std/assert";

import { handleMigrationsOAuthCallback } from "../index.ts";
import {
  createMockSupabaseClient,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";

const TEST_ENCRYPTION_KEY = btoa("12345678901234567890123456789012");

Deno.test(
  "migrations-oauth-callback rejects invalid state tokens",
  async () => {
    Deno.env.set("TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    const { client } = createMockSupabaseClient({});

    try {
      const response = await handleMigrationsOAuthCallback(
        new Request(
          "https://supabase.test/functions/v1/migrations-oauth-callback?code=abc&state=bad-state&provider=mailchimp",
        ),
        {
          createClient: () => client as never,
          verifyJwt: async () => {
            throw new Error("bad signature");
          },
          encryptToken: async () => "encrypted",
          envGet: makeEnv({
            OAUTH_STATE_SECRET: "state-secret",
            APP_ORIGIN: "https://app.example.test",
          }),
          importKey: async () => ({}) as CryptoKey,
          fetch: globalThis.fetch,
          waitUntil: () => undefined,
        },
      );

      assertEquals(response.status, 400);
      assertStringIncludes(
        await response.text(),
        "Invalid or expired state token",
      );
    } finally {
      Deno.env.delete("TOKEN_ENCRYPTION_KEY");
    }
  },
);

Deno.test(
  "migrations-oauth-callback stores Mailchimp tokens and triggers artifact pre-cache",
  async () => {
    Deno.env.set("TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    const { client, recorder } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
      "provider_connections:select": { data: null, error: null },
      "provider_connections:insert": { data: null, error: null },
      "functions:mailchimp-fetch-lists": { data: { lists: [] }, error: null },
    });

    const waitUntilPromises: Promise<unknown>[] = [];
    let fetchCount = 0;

    try {
      const response = await handleMigrationsOAuthCallback(
        new Request(
          "https://supabase.test/functions/v1/migrations-oauth-callback?code=abc&state=good-state&provider=mailchimp",
        ),
        {
          createClient: () => client as never,
          verifyJwt: async () => ({
            provider: "mailchimp",
            redirectUri:
              "https://supabase.test/functions/v1/migrations-oauth-callback?provider=mailchimp",
            appOrigin: "https://app.example.test",
            uid: "user-1",
          }),
          encryptToken: async (value) => `enc:${value}`,
          envGet: makeEnv({
            OAUTH_STATE_SECRET: "state-secret",
            MAILCHIMP_CLIENT_ID: "client-id",
            MAILCHIMP_CLIENT_SECRET: "client-secret",
            APP_ORIGIN: "https://app.example.test",
            SUPABASE_URL: "https://supabase.test",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          }),
          importKey: async () => ({}) as CryptoKey,
          fetch: async (input) => {
            fetchCount += 1;
            const url = String(input);
            if (url.includes("oauth2/token")) {
              return new Response(
                JSON.stringify({ access_token: "mailchimp-access" }),
                {
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            return new Response(
              JSON.stringify({
                id: "account-1",
                accountname: "Bloom Account",
                dc: "us1",
                api_endpoint: "https://us1.api.mailchimp.com",
              }),
              {
                headers: { "Content-Type": "application/json" },
              },
            );
          },
          waitUntil: (promise) => {
            waitUntilPromises.push(promise);
          },
        },
      );

      assertEquals(response.status, 302);
      assertEquals(
        response.headers.get("Location"),
        "https://app.example.test/oauth/callback?provider=mailchimp&status=success",
      );
      assertEquals(fetchCount, 2);

      const insertEntry = recorder.find(
        (entry) =>
          entry.table === "provider_connections" &&
          entry.operation === "insert",
      );
      const insertPayload = insertEntry?.payload as Record<string, unknown>;
      assertEquals(insertPayload.status, "connected");
      assertEquals(
        insertPayload.encrypted_access_token,
        "enc:mailchimp-access",
      );

      assertEquals(waitUntilPromises.length, 1);
      await Promise.all(waitUntilPromises);
      const invokeEntry = recorder.find(
        (entry) => entry.table === "functions:mailchimp-fetch-lists",
      );
      const invokePayload = invokeEntry?.payload as {
        body: Record<string, unknown>;
      };
      assertEquals(invokePayload.body.preCache, true);
      assertEquals(invokePayload.body.tenant_id, "tenant-1");
    } finally {
      Deno.env.delete("TOKEN_ENCRYPTION_KEY");
    }
  },
);

Deno.test(
  "migrations-oauth-callback redirects to error when token exchange fails",
  async () => {
    Deno.env.set("TOKEN_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    const { client } = createMockSupabaseClient({
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
    });

    try {
      const response = await handleMigrationsOAuthCallback(
        new Request(
          "https://supabase.test/functions/v1/migrations-oauth-callback?code=abc&state=good-state&provider=mailchimp",
        ),
        {
          createClient: () => client as never,
          verifyJwt: async () => ({
            provider: "mailchimp",
            redirectUri:
              "https://supabase.test/functions/v1/migrations-oauth-callback?provider=mailchimp",
            appOrigin: "https://app.example.test",
            uid: "user-1",
          }),
          encryptToken: async () => "encrypted",
          envGet: makeEnv({
            OAUTH_STATE_SECRET: "state-secret",
            MAILCHIMP_CLIENT_ID: "client-id",
            MAILCHIMP_CLIENT_SECRET: "client-secret",
            APP_ORIGIN: "https://app.example.test",
            SUPABASE_URL: "https://supabase.test",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          }),
          importKey: async () => ({}) as CryptoKey,
          fetch: async () =>
            new Response(JSON.stringify({ error: "invalid_grant" }), {
              headers: { "Content-Type": "application/json" },
            }),
          waitUntil: () => undefined,
        },
      );

      assertEquals(response.status, 302);
      assertEquals(
        response.headers.get("Location"),
        "https://app.example.test/oauth/callback?provider=mailchimp&status=error",
      );
    } finally {
      Deno.env.delete("TOKEN_ENCRYPTION_KEY");
    }
  },
);
