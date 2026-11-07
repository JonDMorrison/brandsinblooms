import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  costMicros,
  createSpendMeter,
  meteredModelFetch,
  priceForModel,
  SPEND_CAP_MESSAGE,
  SpendCapReachedError,
  type SpendRpcClient,
} from "../../supabase/functions/bloom-assist/security/spend-cap";

type Row = { id: string; tenant: string; reserved: number; status: "reserved" | "settled" | "released"; input?: number | null; output?: number | null; cost?: number };

/**
 * In-memory stand-in for public.bloom_chat_spend_* with the same semantics as
 * the migration: each RPC runs as one serialized step after a random delay, the
 * way the counter row lock serializes calls in Postgres.
 */
function spendDb(opts: { defaultCap: number; overrides?: Record<string, number>; committed?: Record<string, number> }) {
  const committed = new Map(Object.entries(opts.committed ?? {}));
  const rows = new Map<string, Row>();
  const calls: string[] = [];
  const cap = (t: string) => opts.overrides?.[t] ?? opts.defaultCap;
  let seq = 0;
  const client: SpendRpcClient = {
    rpc(fn, args) {
      calls.push(fn);
      return new Promise((resolve) => setTimeout(() => {
        const t = String(args.p_tenant_id ?? "");
        if (fn === "bloom_chat_spend_status") {
          resolve({ data: { committed_micros: committed.get(t) ?? 0, cap_micros: cap(t) }, error: null });
        } else if (fn === "bloom_chat_spend_reserve") {
          const now = committed.get(t) ?? 0;
          const est = Number(args.p_estimate_micros);
          if (now + est > cap(t)) return resolve({ data: { allowed: false }, error: null });
          committed.set(t, now + est);
          const id = `r${++seq}`;
          rows.set(id, { id, tenant: t, reserved: est, status: "reserved" });
          resolve({ data: { allowed: true, reservation_id: id }, error: null });
        } else if (fn === "bloom_chat_spend_settle") {
          const r = rows.get(String(args.p_reservation_id));
          if (!r || r.status !== "reserved") return resolve({ data: { settled: false }, error: null });
          const released = args.p_input_tokens === null;
          const cost = released ? 0 : Number(args.p_cost_micros);
          committed.set(r.tenant, Math.max(0, (committed.get(r.tenant) ?? 0) + cost - r.reserved));
          Object.assign(r, { status: released ? "released" : "settled", input: args.p_input_tokens, output: args.p_output_tokens, cost });
          resolve({ data: { settled: true }, error: null });
        } else {
          resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
        }
      }, Math.floor(Math.random() * 5)));
    },
  };
  return { client, committed, rows, calls };
}

const URL_ = "https://api.openai.com/v1/chat/completions";
const body = (extra: Record<string, unknown> = {}) => JSON.stringify({ model: "gpt-4o-mini", max_tokens: 100, messages: [{ role: "user", content: "hello" }], ...extra });
const jsonReply = (usage = { prompt_tokens: 1200, completion_tokens: 80 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }], usage }), { status: 200 });

describe("Bloom chat spending cap", () => {
  it("under the cap: the call runs and its actual tokens and cost are recorded for the tenant", async () => {
    const db = spendDb({ defaultCap: 25_000_000 });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: "u1" });
    const fetchImpl = vi.fn(async () => jsonReply());
    const res = await meteredModelFetch(meter, "intent", URL_, { method: "POST", body: body() }, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ choices: [{ message: { content: "hi" } }] });
    const [row] = [...db.rows.values()];
    expect(row).toMatchObject({ tenant: "t1", status: "settled", input: 1200, output: 80, cost: costMicros("gpt-4o-mini", 1200, 80) });
    expect(db.committed.get("t1")).toBe(costMicros("gpt-4o-mini", 1200, 80));
  });

  it("settles a streamed reply from its usage chunk even when the reader stops at [DONE]", async () => {
    const db = spendDb({ defaultCap: 25_000_000 });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: null });
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":5000,"completion_tokens":300}}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    const chunks = sse.split("\n\n").filter(Boolean).map((c) => new TextEncoder().encode(`${c}\n\n`));
    const fetchImpl = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { chunks.forEach((c) => controller.enqueue(c)); controller.close(); },
    }), { status: 200 });
    const res = await meteredModelFetch(meter, "chat", URL_, { method: "POST", body: body({ model: "gpt-4o", stream: true }) }, fetchImpl);
    // Read like the stream handler does: stop at [DONE] without draining to EOF.
    const reader = res.body!.getReader();
    let seen = "";
    while (!seen.includes("[DONE]")) {
      const { value, done } = await reader.read();
      if (done) break;
      seen += new TextDecoder().decode(value);
    }
    reader.releaseLock();
    expect(seen).toContain("[DONE]");
    expect([...db.rows.values()][0]).toMatchObject({ status: "settled", input: 5000, output: 300, cost: costMicros("gpt-4o", 5000, 300) });
  });

  it("over the cap: refuses before the model call is made", async () => {
    const db = spendDb({ defaultCap: 25_000_000, committed: { t1: 25_000_000 } });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: "u1" });
    const fetchImpl = vi.fn(async () => jsonReply());
    expect(await meter.isOverCap()).toBe(true);
    await expect(meteredModelFetch(meter, "chat", URL_, { method: "POST", body: body() }, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SpendCapReachedError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.rows.size).toBe(0);
    expect(SPEND_CAP_MESSAGE).toMatch(/^Bloom has reached this month's usage limit for your company/);
  });

  it("honours a per-tenant override set by a platform admin", async () => {
    const db = spendDb({ defaultCap: 25_000_000, overrides: { t1: 100_000_000 }, committed: { t1: 30_000_000, t2: 30_000_000 } });
    const fetchImpl = vi.fn(async () => jsonReply());
    const t1 = createSpendMeter({ client: db.client, tenantId: "t1", userId: null });
    const t2 = createSpendMeter({ client: db.client, tenantId: "t2", userId: null });
    await meteredModelFetch(t1, "chat", URL_, { method: "POST", body: body() }, fetchImpl as unknown as typeof fetch);
    await expect(meteredModelFetch(t2, "chat", URL_, { method: "POST", body: body() }, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SpendCapReachedError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("a tenant cannot change its cap: chat only reads/reserves, and the database refuses tenants", async () => {
    const db = spendDb({ defaultCap: 10 });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: "u1" });
    const fetchImpl = vi.fn(async () => jsonReply());
    // Cap-shaped fields in a request are just prompt data; they never reach the cap.
    await expect(meteredModelFetch(meter, "chat", URL_, { method: "POST", body: body({ cap_micros: 1e12, spend_cap: 1e12 }) }, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SpendCapReachedError);
    expect(new Set(db.calls)).toEqual(new Set(["bloom_chat_spend_reserve"]));

    const sql = fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261104150000_bloom_support_chat_spend_cap.sql"), "utf8");
    expect(sql).toMatch(/ALTER TABLE bloom_support\.chat_spend_caps ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON bloom_support\.chat_spend_caps FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.bloom_chat_spend_set_cap\(uuid, uuid, numeric, text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT[^;]*TO[^;]*(authenticated|anon)/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    const setCap = sql.slice(sql.indexOf("FUNCTION public.bloom_chat_spend_set_cap"));
    expect(setCap).toMatch(/require_permission\(p_actor, 'admin\.policy'\)/);
    expect(setCap).toMatch(/principal_role\(p_actor\) IS DISTINCT FROM 'platform_admin'/);
  });

  it("parallel calls cannot blow far past the cap (reserve-then-settle)", async () => {
    const db = spendDb({ defaultCap: 1_000_000 });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: null });
    const reqBody = body({ model: "gpt-4o", max_tokens: 8000 });
    let ran = 0;
    const fetchImpl = async () => {
      ran += 1;
      await new Promise((r) => setTimeout(r, 5));
      return jsonReply({ prompt_tokens: 3000, completion_tokens: 2000 });
    };
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () => meteredModelFetch(meter, "chat", URL_, { method: "POST", body: reqBody }, fetchImpl)),
    );
    const actual = costMicros("gpt-4o", 3000, 2000);
    // 40 unchecked calls would spend 40 x actual, which is over the cap.
    expect(40 * actual).toBeGreaterThan(1_000_000);
    const spent = [...db.rows.values()].reduce((sum, r) => sum + (r.cost ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(1_000_000);
    expect(ran).toBe(db.rows.size);
    expect(results.filter((r) => r.status === "rejected").length).toBe(40 - ran);
    expect(results.filter((r) => r.status === "rejected").length).toBeGreaterThan(0);
    expect(db.committed.get("t1")!).toBeLessThanOrEqual(1_000_000);
    expect([...db.rows.values()].every((r) => r.status === "settled")).toBe(true);
  });

  it("releases the reservation when the provider refuses the request", async () => {
    const db = spendDb({ defaultCap: 25_000_000 });
    const meter = createSpendMeter({ client: db.client, tenantId: "t1", userId: null });
    const res = await meteredModelFetch(meter, "chat", URL_, { method: "POST", body: body() }, async () => new Response("{}", { status: 429 }));
    expect(res.status).toBe(429);
    expect([...db.rows.values()][0].status).toBe("released");
    expect(db.committed.get("t1")).toBe(0);
  });

  it("prices dated snapshots by family and unknown models at the highest known price", () => {
    expect(priceForModel("gpt-4.1-2025-04-14")).toEqual({ input: 2, output: 8 });
    expect(priceForModel("gpt-4o-mini")).toEqual({ input: 0.15, output: 0.6 });
    expect(priceForModel("mystery-model")).toEqual({ input: 2.5, output: 10 });
    expect(costMicros("gpt-4o", 1_000_000, 0)).toBe(2_500_000);
  });

  it("every Bloom chat model request goes through the metered fetch", () => {
    const root = path.resolve(__dirname, "../../supabase/functions/bloom-assist");
    const files: string[] = [];
    const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".ts")) files.push(p);
    });
    walk(root);
    const unmetered = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /(?<!metered\w*)\bfetch\(\s*(OPENAI_CHAT_COMPLETIONS_URL|["'`]https:\/\/api\.openai\.com\/v1\/chat\/completions)/.test(src);
    });
    expect(unmetered.map((f) => path.relative(root, f))).toEqual([]);
  });
});
