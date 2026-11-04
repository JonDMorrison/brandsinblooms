// Per-company monthly spending cap for Bloom chat model calls.
//
// Every model call bloom-assist makes goes through meteredModelFetch:
//   1. reserve  — the estimated cost (prompt size + max output tokens) is added
//                 to the tenant's month-to-date total in one locked database
//                 step (public.bloom_chat_spend_reserve). If that would pass the
//                 cap the call is refused and no request reaches the provider.
//   2. call     — the provider request runs.
//   3. settle   — the actual input/output tokens from the provider's `usage`
//                 replace the reservation (public.bloom_chat_spend_settle).
// Reserve-then-settle means many parallel calls cannot all pass a stale
// "under cap" check: each one holds its share of the budget before it runs.
//
// The cap and the per-tenant override live in the database and are only
// changed by a platform admin (bloom_support admin.policy). Nothing in a chat
// request can raise them. The cap is an internal cost guard and does not change
// what customers are charged.

export const SPEND_CAP_MESSAGE =
  "Bloom has reached this month's usage limit for your company. Your data, approvals and the rest of BloomSuite keep working as normal. A BloomSuite administrator can raise the limit, or it resets on the 1st of next month.";

/**
 * Provider list prices in USD per 1M tokens (OpenAI public pricing, standard
 * tier, checked 2026-11-04). Used only to estimate spend against the cap.
 * Model ids are matched by the longest prefix, so dated snapshots such as
 * "gpt-4.1-2025-04-14" use the "gpt-4.1" price. An unknown model is charged at
 * the most expensive price in this table so it can never slip under the cap.
 */
export const MODEL_PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5": { input: 1.25, output: 10 },
};

const FALLBACK_PRICE = Object.values(MODEL_PRICES_USD_PER_MILLION).reduce((worst, p) => ({
  input: Math.max(worst.input, p.input),
  output: Math.max(worst.output, p.output),
}));

/** Output tokens assumed for a reservation when the request sets no limit. */
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;

export function priceForModel(model: string): { input: number; output: number } {
  const id = model.trim().toLowerCase();
  let best: string | null = null;
  for (const key of Object.keys(MODEL_PRICES_USD_PER_MILLION)) {
    if ((id === key || id.startsWith(`${key}-`)) && (!best || key.length > best.length)) best = key;
  }
  return best ? MODEL_PRICES_USD_PER_MILLION[best] : FALLBACK_PRICE;
}

/** Cost in micro-USD (1 USD = 1,000,000), rounded up. */
export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceForModel(model);
  return Math.ceil(Math.max(0, inputTokens) * p.input + Math.max(0, outputTokens) * p.output);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Upper-bound estimate for one chat-completions request body. */
export function estimateRequestCost(body: Record<string, unknown>): { model: string; micros: number } {
  const model = typeof body.model === "string" ? body.model : "unknown";
  // ~4 characters per token for the serialized prompt and tool schemas.
  const promptChars = JSON.stringify(body.messages ?? []).length + JSON.stringify(body.tools ?? []).length;
  const maxOut = Number(body.max_tokens ?? body.max_completion_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS);
  return {
    model,
    micros: costMicros(model, Math.ceil(promptChars / 4), Number.isFinite(maxOut) && maxOut > 0 ? maxOut : DEFAULT_MAX_OUTPUT_TOKENS),
  };
}

export class SpendCapReachedError extends Error {
  constructor() {
    super(SPEND_CAP_MESSAGE);
    this.name = "SpendCapReachedError";
  }
}

export function isSpendCapReached(error: unknown): error is SpendCapReachedError {
  return error instanceof SpendCapReachedError;
}

type RpcResult = { data: unknown; error: { message: string } | null };
export type SpendRpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type SpendTicket = {
  /** Records actual usage. `null` keeps the reservation as the charge (usage unknown). */
  settle(usage: TokenUsage | null): Promise<void>;
  /** The call did not run or the provider refused it: nothing was billed. */
  release(): Promise<void>;
};

export type SpendMeter = {
  tenantId: string;
  /** True when the tenant has already reached this month's cap. */
  isOverCap(): Promise<boolean>;
  /** Reserves budget for one call; throws SpendCapReachedError when over the cap. */
  reserve(feature: string, model: string, estimateMicros: number): Promise<SpendTicket>;
};

const NOOP_TICKET: SpendTicket = { settle: () => Promise.resolve(), release: () => Promise.resolve() };

export function createSpendMeter(args: { client: SpendRpcClient; tenantId: string; userId: string | null }): SpendMeter {
  const { client, tenantId, userId } = args;
  return {
    tenantId,
    async isOverCap() {
      const { data, error } = await client.rpc("bloom_chat_spend_status", { p_tenant_id: tenantId });
      if (error || !isRecord(data)) {
        // Availability over strictness: a broken status read must not take chat
        // down. Each model call still reserves, which enforces the cap.
        console.error("[bloom-assist] Spend status unavailable", error?.message ?? "no data");
        return false;
      }
      return Number(data.committed_micros) >= Number(data.cap_micros);
    },
    async reserve(feature, model, estimateMicros) {
      const { data, error } = await client.rpc("bloom_chat_spend_reserve", {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_feature: feature,
        p_model: model,
        p_estimate_micros: Math.max(0, Math.ceil(estimateMicros)),
      });
      if (error || !isRecord(data)) {
        console.error("[bloom-assist] Spend reservation unavailable; call not metered", error?.message ?? "no data");
        return NOOP_TICKET;
      }
      if (data.allowed !== true) throw new SpendCapReachedError();
      const reservationId = String(data.reservation_id);
      let done = false;
      const finish = async (usage: TokenUsage | null, released: boolean) => {
        if (done) return;
        done = true;
        if (!released && !usage) return; // keep the estimate as the charge
        const { error: settleError } = await client.rpc("bloom_chat_spend_settle", {
          p_reservation_id: reservationId,
          p_input_tokens: released ? null : usage!.inputTokens,
          p_output_tokens: released ? null : usage!.outputTokens,
          p_cost_micros: released ? 0 : costMicros(model, usage!.inputTokens, usage!.outputTokens),
        });
        if (settleError) console.error("[bloom-assist] Spend settle failed", settleError.message);
      };
      return { settle: (usage) => finish(usage, false), release: () => finish(null, true) };
    },
  };
}

function readUsage(payload: unknown): TokenUsage | null {
  if (!isRecord(payload) || !isRecord(payload.usage)) return null;
  const input = Number(payload.usage.prompt_tokens ?? payload.usage.input_tokens);
  const output = Number(payload.usage.completion_tokens ?? payload.usage.output_tokens);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return { inputTokens: input, outputTokens: output };
}

/** Wraps an SSE body so the ticket settles as soon as the usage chunk passes through. */
function settleFromStream(body: ReadableStream<Uint8Array>, ticket: SpendTicket): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let settled = false;
  const scan = async (text: string) => {
    buffer += text;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (settled || !trimmed.startsWith("data:") || !trimmed.includes("\"usage\"")) continue;
      try {
        const usage = readUsage(JSON.parse(trimmed.slice(5).trim()));
        if (usage) {
          settled = true;
          await ticket.settle(usage);
        }
      } catch {
        // Not JSON; the stream consumer handles it.
      }
    }
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer) await scan("\n");
        if (!settled) await ticket.settle(null);
        controller.close();
        return;
      }
      await scan(decoder.decode(value, { stream: true }));
      controller.enqueue(value);
    },
    async cancel(reason) {
      if (!settled) await ticket.settle(null);
      await reader.cancel(reason);
    },
  });
}

/**
 * fetch() for a model provider request, metered against the tenant's cap.
 * With no meter it is a plain fetch (callers outside a tenant chat turn).
 */
export async function meteredModelFetch(
  meter: SpendMeter | null | undefined,
  feature: string,
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!meter) return fetchImpl(url, init);
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = typeof init.body === "string" ? JSON.parse(init.body) : {};
    if (isRecord(parsed)) body = parsed;
  } catch {
    body = {};
  }
  const estimate = estimateRequestCost(body);
  const ticket = await meter.reserve(feature, estimate.model, estimate.micros);

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    await ticket.release();
    throw error;
  }
  if (!response.ok) {
    await ticket.release();
    return response;
  }
  if (body.stream === true && response.body) {
    return new Response(settleFromStream(response.body, ticket), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  const text = await response.text();
  let usage: TokenUsage | null = null;
  try {
    usage = readUsage(JSON.parse(text));
  } catch {
    usage = null;
  }
  await ticket.settle(usage);
  return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
}
