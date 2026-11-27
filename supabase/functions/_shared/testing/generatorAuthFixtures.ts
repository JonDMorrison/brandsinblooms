// Shared fixtures for the AI generator auth tests (see _shared/generatorAuth.ts).
import {
  createMockSupabaseClient,
  jsonRequest,
  makeEnv,
  type QueryResponse,
} from "./testHarness.ts";

export const TOKEN_USER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
export const OWN_TENANT_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_TENANT_ID = "44444444-4444-4444-8444-444444444444";

export const ENV = makeEnv({
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OPENAI_API_KEY: "openai-key",
});

export function generatorRequest(
  body: Record<string, unknown>,
  token: string | null = "user-jwt",
): Request {
  return jsonRequest("https://example.test", body, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * A mock client for an authenticated user. `canAccess` is the answer
 * bloom_can_access_tenant gives; `extra` seeds the queries the function makes
 * after the auth checks.
 */
export function authedClient(options: {
  canAccess: boolean;
  extra?: Record<string, QueryResponse<unknown> | QueryResponse<unknown>[]>;
  userId?: string | null;
}) {
  const userId = options.userId === undefined ? TOKEN_USER_ID : options.userId;
  return createMockSupabaseClient({
    "auth:getUser": userId
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: { message: "invalid JWT" } },
    "users:select": { data: { tenant_id: OWN_TENANT_ID }, error: null },
    "rpc:bloom_can_access_tenant": { data: options.canAccess, error: null },
    ...(options.extra ?? {}),
  });
}

/** Records every createClient call so tests can prove which key was used. */
export function recordingCreateClient(client: unknown) {
  const calls: Array<{ url: string; key: string }> = [];
  const createClient = (url: string, key: string) => {
    calls.push({ url, key });
    return client;
  };
  return { calls, createClient };
}

/**
 * Replace global fetch with an OpenAI chat-completions stub. With
 * `toolArguments`, the message also carries a function tool call whose
 * arguments are that object, as JSON, and whose name is `toolName`.
 */
export function stubOpenAI(
  content: string | (() => string),
  toolArguments?: Record<string, unknown>,
  toolName = "tool",
) {
  const original = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = null;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : null;
    } catch {
      body = init?.body ?? null;
    }
    requests.push({ url, body });
    const text = typeof content === "function" ? content() : content;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: text,
              ...(toolArguments
                ? { tool_calls: [{ type: "function", function: { name: toolName, arguments: JSON.stringify(toolArguments) } }] }
                : {}),
            },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;
  return {
    requests,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
