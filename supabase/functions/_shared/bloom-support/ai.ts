// Bloom Support — replaceable model provider. Recommendations only: callers
// validate every field and fall back to deterministic rules when the model is
// unavailable, over budget, or returns anything out of vocabulary.
import { env, rpc } from "./runtime.ts";
import type { OpenAIImageContentPart, OpenAITextContentPart } from "../../bloom-assist/types.ts";

export interface AiConfig {
  provider: "openai" | "none";
  model: string;
  baseUrl: string;
  maxCallsPerAccountPerDay: number;
  maxCallsPerDayTotal: number;
  missing: string[];
}

export async function aiConfig(): Promise<AiConfig> {
  const stored = (await rpc<Record<string, unknown> | null>("setting", { key: "ai" })) ?? {};
  const provider = (env("BLOOM_AI_PROVIDER") ?? String(stored.provider ?? "openai")) as AiConfig["provider"];
  const missing: string[] = [];
  if (provider === "openai" && !env("OPENAI_API_KEY")) missing.push("OPENAI_API_KEY");
  return {
    provider: missing.length ? "none" : provider,
    // Settings (admin-editable at runtime) win over the env default.
    model: String(stored.model ?? env("BLOOM_AI_MODEL") ?? "gpt-4o-mini"),
    // OpenAI-compatible endpoint; swap BLOOM_AI_BASE_URL to change vendors.
    baseUrl: env("BLOOM_AI_BASE_URL") ?? "https://api.openai.com/v1",
    maxCallsPerAccountPerDay: Number(stored.max_calls_per_account_per_day ?? 200),
    maxCallsPerDayTotal: Number(((await rpc<Record<string, unknown> | null>("setting", { key: "limits" })) ?? {}).ai_calls_per_day_total ?? 1000),
    missing,
  };
}

export interface JsonCall {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  accountKey: string;
  timeoutMs?: number;
  /** Client screenshots as chat-completions image parts (see vision.ts). */
  images?: OpenAIImageContentPart[];
}

type UserContent = string | Array<OpenAITextContentPart | OpenAIImageContentPart>;

/** The chat-completions user turn: plain text, or text followed by image parts. */
export function userContent(text: string, images: OpenAIImageContentPart[] = []): UserContent {
  return images.length ? [{ type: "text", text }, ...images] : text;
}

export type AiResult<T> = { ok: true; value: T; model: string } | { ok: false; reason: string };

export async function completeJson<T>(call: JsonCall): Promise<AiResult<T>> {
  const cfg = await aiConfig();
  if (cfg.provider === "none") return { ok: false, reason: cfg.missing.length ? `not configured: ${cfg.missing.join(", ")}` : "provider disabled" };
  const day = new Date().toISOString().slice(0, 10);
  const total = await rpc<boolean>("consume_usage", { bucket: `ai-total:${day}`, subject: "all", limit: cfg.maxCallsPerDayTotal });
  if (!total) return { ok: false, reason: "daily model budget for Bloom reached (limits.ai_calls_per_day_total)" };
  const allowed = await rpc<boolean>("consume_usage", { bucket: `ai:${day}`, subject: call.accountKey, limit: cfg.maxCallsPerAccountPerDay });
  if (!allowed) return { ok: false, reason: "daily model budget for this account reached" };
  const request = (content: UserContent) =>
    fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: call.system }, { role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: call.schemaName, strict: true, schema: call.schema } },
      }),
      signal: AbortSignal.timeout(call.timeoutMs ?? 30000),
    });
  try {
    const images = call.images ?? [];
    let res = await request(userContent(call.user, images));
    let withImages = images.length;
    // A rejected image (unsupported by the configured model, unreadable) must
    // not cost the whole recommendation: retry once with the text alone.
    if (!res.ok && images.length && res.status >= 400 && res.status < 500 && res.status !== 429) {
      console.error(`bloom-support ai: ${call.schemaName} with ${images.length} image(s) refused (http ${res.status}); retrying text-only`);
      await res.body?.cancel();
      res = await request(call.user);
      withImages = 0;
    }
    if (!res.ok) return { ok: false, reason: `model http ${res.status}` };
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, reason: "model returned no content" };
    // Usage is billed to the OpenAI API account (not a ChatGPT subscription); record it.
    await rpc("log_usage", { detail: { model: cfg.model, schema: call.schemaName, account: call.accountKey, images: withImages, usage: body?.usage ?? null } }).catch(() => undefined);
    return { ok: true, value: JSON.parse(content) as T, model: cfg.model };
  } catch (e) {
    return { ok: false, reason: `model error: ${String(e).slice(0, 200)}` };
  }
}

// Untrusted text is fenced and labelled so the model treats it as data.
// Lives in fence.ts (no Deno globals) so pure modules and their tests can use it.
export { fence } from "./fence.ts";

export const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "priority", "impact", "category", "missing", "confidence", "summary"],
  properties: {
    kind: { type: "string", enum: ["unknown", "question", "bug", "change", "incident", "feature", "other"] },
    priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
    impact: { type: "string", enum: ["unknown", "single_user", "account", "multi_account", "platform"] },
    category: { type: "string" },
    missing: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    summary: { type: "string" },
  },
};

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answerable", "answer", "cited_article_ids"],
  properties: {
    answerable: { type: "boolean" },
    answer: { type: "string" },
    cited_article_ids: { type: "array", items: { type: "string" } },
  },
};
