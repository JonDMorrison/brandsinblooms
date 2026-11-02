import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  claimAction,
  findStoredActionCard,
  sameArguments,
} from "../../supabase/functions/bloom-assist/action-claims";
import type { PersistenceClient } from "../../supabase/functions/bloom-assist/types";

type Row = Record<string, unknown>;

/** In-memory bloom_action_claims with a primary key on mutation_id. */
function claimsTable() {
  const rows = new Map<string, Row>();
  const client = {
    from: () => {
      let mode: "select" | "update" | null = null;
      let patch: Row = {};
      const filters: [string, unknown][] = [];
      const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
      const q = {
        insert: async (row: Row) => {
          const id = row.mutation_id as string;
          if (rows.has(id)) return { error: { code: "23505", message: "duplicate key" } };
          rows.set(id, { ...row });
          return { error: null };
        },
        select: () => {
          if (mode !== "update") mode = "select";
          return q;
        },
        update: (p: Row) => { mode = "update"; patch = p; return q; },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: async () => ({ data: [...rows.values()].find(match) ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (mode === "update") {
            const hit = [...rows.values()].filter(match);
            hit.forEach((r) => Object.assign(r, patch));
            resolve({ data: hit.map((r) => ({ mutation_id: r.mutation_id })), error: null });
          } else resolve({ data: null, error: null });
        },
      };
      return q;
    },
  } as unknown as Pick<PersistenceClient, "from">;
  return { rows, client };
}

const claim = { mutationId: "mut_1", tenantId: "t1", userId: "u1", conversationId: "c1", messageId: "m1", toolName: "update_customer" };

describe("Ask Bloom approvals run the stored change exactly once", () => {
  it("finds the card Bloom stored on the assistant message", () => {
    const blockData = {
      blocks: [
        { block_type: "text", content: "hi", payload: {} },
        { block_type: "mutation_action", payload: { mutationId: "mut_1", toolName: "update_customer", toolArgs: { id: "x", first_name: "Ann" }, status: "pending" } },
      ],
    };
    expect(findStoredActionCard(blockData, "mut_1")).toEqual({
      mutationId: "mut_1", toolName: "update_customer", toolArgs: { id: "x", first_name: "Ann" }, status: "pending",
    });
    expect(findStoredActionCard(blockData, "mut_other")).toBeNull();
    expect(findStoredActionCard({}, "mut_1")).toBeNull();
  });

  it("treats re-ordered arguments as the same and changed arguments as different", () => {
    expect(sameArguments({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(sameArguments({ id: "x", first_name: "Ann" }, { id: "x", first_name: "Bob" })).toBe(false);
    expect(sameArguments({ id: "x" }, { id: "x", delete: true })).toBe(false);
  });

  it("claims once; a second approval while running is refused", async () => {
    const { client } = claimsTable();
    await expect(claimAction(client, claim)).resolves.toEqual({ kind: "claimed" });
    await expect(claimAction(client, claim)).resolves.toEqual({ kind: "in_progress" });
  });

  it("returns the recorded result instead of running a completed change again", async () => {
    const { client, rows } = claimsTable();
    await claimAction(client, claim);
    Object.assign(rows.get("mut_1")!, { status: "completed", result: "Updated Ann" });
    await expect(claimAction(client, claim)).resolves.toEqual({ kind: "already_done", status: "completed", result: "Updated Ann" });
  });

  it("lets the person retry after a failure, but only one retry wins", async () => {
    const { client, rows } = claimsTable();
    await claimAction(client, claim);
    Object.assign(rows.get("mut_1")!, { status: "failed", result: "network" });
    await expect(claimAction(client, claim)).resolves.toEqual({ kind: "claimed" });
    expect(rows.get("mut_1")!.status).toBe("executing");
    await expect(claimAction(client, claim)).resolves.toEqual({ kind: "in_progress" });
  });

  it("never exposes another company's claim", async () => {
    const { client, rows } = claimsTable();
    await claimAction(client, claim);
    Object.assign(rows.get("mut_1")!, { status: "completed", result: "secret" });
    await expect(claimAction(client, { ...claim, tenantId: "t2" })).resolves.toEqual({ kind: "in_progress" });
  });

  it("execute_action uses the stored arguments, not the browser's", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../supabase/functions/bloom-assist/index.ts"), "utf8");
    const handler = src.slice(src.indexOf("async function createExecuteActionResponse"), src.indexOf("export async function handleRequest"));
    expect(handler).toContain("executeTool(stored.toolName, stored.toolArgs");
    expect(handler).not.toContain("payload.action.toolArgs, {");
    expect(handler).toContain("claimAction(");
  });
});
