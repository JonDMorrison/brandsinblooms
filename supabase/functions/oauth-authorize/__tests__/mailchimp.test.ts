import { assertEquals, assertStringIncludes } from "@std/assert";

import { handleOAuthAuthorize } from "../index.ts";
import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
} from "../../_shared/testing/testHarness.ts";

Deno.test(
  "oauth-authorize returns 500 when required Mailchimp env vars are missing",
  async () => {
    const { client } = createMockSupabaseClient({});

    const response = await handleOAuthAuthorize(
      jsonRequest("https://example.test", { provider: "mailchimp" }),
      {
        createClient: () => client as never,
        envGet: makeEnv({ SUPABASE_URL: "https://supabase.test" }),
        createJwt: async () => "ignored",
        getNumericDate: () => 123,
        randomUUID: () => "uuid",
        importKey: async () => ({}) as CryptoKey,
      },
    );

    assertEquals(response.status, 500);
    assertStringIncludes(await response.text(), "OAUTH_STATE_SECRET");
  },
);

Deno.test(
  "oauth-authorize returns 401 when the user session is missing",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: null }, error: { message: "expired" } },
    });

    const response = await handleOAuthAuthorize(
      jsonRequest(
        "https://example.test",
        { provider: "mailchimp" },
        { headers: { Authorization: "Bearer token" } },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_ANON_KEY: "anon-key",
          OAUTH_STATE_SECRET: "state-secret",
          MAILCHIMP_CLIENT_ID: "mailchimp-client-id",
          MAILCHIMP_CLIENT_SECRET: "mailchimp-client-secret",
        }),
        createJwt: async () => "ignored",
        getNumericDate: () => 123,
        randomUUID: () => "uuid",
        importKey: async () => ({}) as CryptoKey,
      },
    );

    assertEquals(response.status, 401);
  },
);

Deno.test(
  "oauth-authorize builds a Mailchimp auth URL and signed state payload",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
    });

    const response = await handleOAuthAuthorize(
      jsonRequest(
        "https://example.test",
        { provider: "mailchimp" },
        {
          headers: {
            Authorization: "Bearer token",
            Origin: "https://app.example.test",
          },
        },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_ANON_KEY: "anon-key",
          OAUTH_STATE_SECRET: "state-secret",
          MAILCHIMP_CLIENT_ID: "mailchimp-client-id",
          MAILCHIMP_CLIENT_SECRET: "mailchimp-client-secret",
        }),
        createJwt: async () => "signed-state",
        getNumericDate: () => 123,
        randomUUID: () => "uuid-123",
        importKey: async () => ({}) as CryptoKey,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.state, "signed-state");
    assertStringIncludes(body.authUrl, "login.mailchimp.com/oauth2/authorize");
    assertStringIncludes(body.authUrl, "client_id=mailchimp-client-id");
    assertStringIncludes(body.authUrl, "state=signed-state");
  },
);

Deno.test(
  "oauth-authorize uses development Mailchimp credentials for preview origins",
  async () => {
    const { client } = createMockSupabaseClient({
      "auth:getUser": { data: { user: { id: "user-1" } }, error: null },
      "users:select": { data: { tenant_id: "tenant-1" }, error: null },
    });

    const response = await handleOAuthAuthorize(
      jsonRequest(
        "https://example.test",
        { provider: "mailchimp" },
        {
          headers: {
            Authorization: "Bearer token",
            Origin: "https://preview-123.lovable.app",
          },
        },
      ),
      {
        createClient: () => client as never,
        envGet: makeEnv({
          SUPABASE_URL: "https://supabase.test",
          SUPABASE_ANON_KEY: "anon-key",
          OAUTH_STATE_SECRET: "state-secret",
          MAILCHIMP_CLIENT_ID_DEV: "mailchimp-client-id-dev",
          MAILCHIMP_CLIENT_SECRET_DEV: "mailchimp-client-secret-dev",
        }),
        createJwt: async () => "signed-state",
        getNumericDate: () => 123,
        randomUUID: () => "uuid-123",
        importKey: async () => ({}) as CryptoKey,
      },
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertStringIncludes(body.authUrl, "client_id=mailchimp-client-id-dev");
  },
);
