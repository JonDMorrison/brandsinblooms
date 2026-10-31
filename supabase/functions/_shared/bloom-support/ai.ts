// Bloom Support — replaceable model provider. Recommendations only: callers
// validate every field and fall back to deterministic rules when the model is
// unavailable, over budget, or returns anything out of vocabulary.
import { env, rpc } from "./runtime.ts";

export interface AiConfig {
  provider: "openai" | "none";
  model: string;
  baseUrl: string;
  maxCallsPerAccountPerDay: number;
  missing: string[];
}

export async function aiConfig(): Promise<AiConfig> {
  const stored = (await rpc<Record<string, unknown> | null>("setting", { key: "ai" })) ?? {};
  const provider = (env("BLOOM_AI_PROVIDER") ?? String(stored.provider ?? "openai")) as AiConfig["provider"];
  const missing: string[] = [];
  if (provider === "openai" && !env("OPENAI_API_KEY")) missing.push("OPENAI_API_KEY");
  return {
    provider: missing.length ? "none" : provider,
    model: env("BLOOM_AI_MODEL") ?? String(stored.model ?? "gpt-5-mini"),
    // OpenAI-compatible endpoint; swap BLOOM_AI_BASE_URL to change vendors.
    baseUrl: env("BLOOM_AI_BASE_URL") ?? "https://api.openai.com/v1",
    maxCallsPerAccountPerDay: Number(stored.max_calls_per_account_per_day ?? 200),
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
}

export type AiResult<T> = { ok: true; value: T; model: string } | { ok: false; reason: string };

export async function completeJson<T>(call: JsonCall): Promise<AiResult<T>> {
  const cfg = await aiConfig();
  if (cfg.provider === "none") return { ok: false, reason: cfg.missing.length ? `not configured: ${cfg.missing.join(", ")}` : "provider disabled" };
  const allowed = await rpc<boolean>("consume_usage", {
    bucket: `ai:${new Date().toISOString().slice(0, 10)}`, subject: call.accountKey, limit: cfg.maxCallsPerAccountPerDay,
  });
  if (!allowed) return { ok: false, reason: "daily model budget for this account reached" };
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: call.system }, { role: "user", content: call.user }],
        response_format: { type: "json_schema", json_schema: { name: call.schemaName, strict: true, schema: call.schema } },
      }),
      signal: AbortSignal.timeout(call.timeoutMs ?? 30000),
    });
    if (!res.ok) return { ok: false, reason: `model http ${res.status}` };
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, reason: "model returned no content" };
    return { ok: true, value: JSON.parse(content) as T, model: cfg.model };
  } catch (e) {
    return { ok: false, reason: `model error: ${String(e).slice(0, 200)}` };
  }
}

/** Untrusted text is fenced and labelled so the model treats it as data. */
export function fence(label: string, text: string): string {
  return `<${label} untrusted="true">\n${text.replace(/<\/?[a-z_]+ untrusted="true">/gi, "").slice(0, 12000)}\n</${label}>`;
}

export const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "priority", "impact", "category", "missing", "confidence", "summary"],
  properties: {
    kind: { type: "string", enum: ["unknown", "bug", "question", "request", "feature", "operation", "account"] },
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
