import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type EnvGetter = (key: string) => string | undefined;

interface WebhookRegistrationRow {
  id: string;
  client_id: string;
  webhook_url: string;
  events: string[];
  signing_secret: string;
}

interface DispatchSupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (payload: unknown) => unknown;
  };
}

interface DispatchQueryChain {
  eq: (column: string, value: unknown) => DispatchQueryChain;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
}

type CreateDispatchClient = (
  supabaseUrl: string,
  supabaseKey: string,
) => DispatchSupabaseClient;

export interface WebhookDispatchDependencies {
  createClient: CreateDispatchClient;
  envGet: EnvGetter;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  now: () => Date;
  randomUUID: () => string;
}

const defaultDependencies: WebhookDispatchDependencies = {
  createClient: (supabaseUrl, supabaseKey) =>
    createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    }) as unknown as DispatchSupabaseClient,
  envGet: (key) => Deno.env.get(key),
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
  randomUUID: () => crypto.randomUUID(),
};

function getRequiredEnv(key: string, envGet: EnvGetter): string {
  const value = envGet(key)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncate(value: string | null, maxLength = 4096): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function insertWebhookLog(
  client: DispatchSupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const result = await (client
      .from("oauth_webhook_logs")
      .insert(payload) as Promise<{
      error: { message: string } | null;
    }>);

    if (result?.error) {
      console.error("[WEBHOOK-DISPATCH] Failed to write webhook log", {
        error: result.error.message,
        payload,
      });
    }
  } catch (error) {
    console.error("[WEBHOOK-DISPATCH] Failed to write webhook log", {
      error: errorMessage(error),
      payload,
    });
  }
}

function mergePayload(
  payload: Record<string, unknown>,
  options?: { userId?: string; tenantId?: string },
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...payload };

  if (options?.userId && merged.user_id === undefined) {
    merged.user_id = options.userId;
  }

  if (options?.tenantId && merged.tenant_id === undefined) {
    merged.tenant_id = options.tenantId;
  }

  return merged;
}

export async function dispatchWebhook(
  event: string,
  payload: Record<string, unknown>,
  options?: { userId?: string; tenantId?: string },
  deps: WebhookDispatchDependencies = defaultDependencies,
): Promise<void> {
  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL", deps.envGet);
    const serviceRoleKey = getRequiredEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      deps.envGet,
    );

    const client = deps.createClient(supabaseUrl, serviceRoleKey);
    const registrationsQuery = client
      .from("oauth_webhook_registrations")
      .select(
        "id, client_id, webhook_url, events, signing_secret",
      ) as DispatchQueryChain;
    const registrationResult = await (registrationsQuery.eq(
      "is_active",
      true,
    ) as unknown as Promise<{
      data: WebhookRegistrationRow[] | null;
      error: { message: string } | null;
    }>);

    if (registrationResult.error) {
      console.error("[WEBHOOK-DISPATCH] Failed to load registrations", {
        event,
        error: registrationResult.error.message,
      });
      return;
    }

    const registrations = (registrationResult.data ?? []).filter(
      (registration) =>
        Array.isArray(registration.events) &&
        registration.events.includes(event),
    );

    if (registrations.length === 0) {
      return;
    }

    await Promise.all(
      registrations.map(async (registration) => {
        const now = deps.now();
        const webhookId = deps.randomUUID();
        const unixTimestamp = Math.floor(now.getTime() / 1000).toString();
        const body = {
          event,
          timestamp: now.toISOString(),
          data: mergePayload(payload, options),
        };
        const bodyText = JSON.stringify(body);

        try {
          const signature = await signPayload(
            registration.signing_secret,
            bodyText,
          );
          const response = await deps.fetch(registration.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": `sha256=${signature}`,
              "X-Webhook-Id": webhookId,
              "X-Webhook-Timestamp": unixTimestamp,
            },
            body: bodyText,
          });

          const responseBody = truncate(await response.text());
          await insertWebhookLog(client, {
            webhook_registration_id: registration.id,
            event,
            payload: body,
            webhook_id: webhookId,
            response_status: response.status,
            response_body: responseBody,
            delivered_at: response.ok ? deps.now().toISOString() : null,
            failed_at: response.ok ? null : deps.now().toISOString(),
          });

          if (!response.ok) {
            console.error("[WEBHOOK-DISPATCH] Webhook delivery failed", {
              event,
              registrationId: registration.id,
              status: response.status,
            });
          }
        } catch (error) {
          await insertWebhookLog(client, {
            webhook_registration_id: registration.id,
            event,
            payload: body,
            webhook_id: webhookId,
            response_status: null,
            response_body: truncate(errorMessage(error)),
            delivered_at: null,
            failed_at: deps.now().toISOString(),
          });

          console.error("[WEBHOOK-DISPATCH] Webhook delivery threw", {
            event,
            registrationId: registration.id,
            error: errorMessage(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("[WEBHOOK-DISPATCH] Dispatch initialization failed", {
      event,
      error: errorMessage(error),
    });
  }
}
