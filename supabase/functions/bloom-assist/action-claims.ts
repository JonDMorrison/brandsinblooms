// Exactly-once approvals for Ask Bloom inline action cards.
//
// When Bloom proposes a change in a resource-focused chat it stores the card
// (tool name and arguments) on the assistant message. Approving it must run
// exactly that stored change, once. The browser's copy of the arguments is
// only used to detect that the card shown to the person has drifted.

import type { JsonObject, PersistenceClient } from "./types.ts";

type ClaimClient = Pick<PersistenceClient, "from">;

export type StoredActionCard = {
  mutationId: string;
  toolName: string;
  toolArgs: JsonObject;
  status: string;
};

export type ClaimOutcome =
  | { kind: "claimed" }
  | { kind: "already_done"; status: "completed"; result: string | null }
  | { kind: "in_progress" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((out, key) => {
    out[key] = sorted(value[key]);
    return out;
  }, {});
}

/** Order-insensitive equality for JSON tool arguments. */
export function sameArguments(a: unknown, b: unknown): boolean {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

/** Finds the card Bloom stored for this mutation on the assistant message. */
export function findStoredActionCard(blockData: unknown, mutationId: string): StoredActionCard | null {
  const blocks = isRecord(blockData) && Array.isArray(blockData.blocks) ? blockData.blocks : [];
  for (const block of blocks) {
    if (!isRecord(block) || block.block_type !== "mutation_action" || !isRecord(block.payload)) continue;
    const p = block.payload;
    const id = typeof p.mutationId === "string" ? p.mutationId : typeof p.mutation_id === "string" ? p.mutation_id : null;
    if (id !== mutationId) continue;
    if (typeof p.toolName !== "string" || !isRecord(p.toolArgs)) return null;
    return {
      mutationId: id,
      toolName: p.toolName,
      toolArgs: p.toolArgs as JsonObject,
      status: typeof p.status === "string" ? p.status : "pending",
    };
  }
  return null;
}

/** Loads the stored card, scoped to the person's tenant and conversation. */
export async function loadStoredActionCard(
  client: ClaimClient,
  args: { tenantId: string; conversationId: string; messageId: string; mutationId: string },
): Promise<StoredActionCard | null> {
  const { data, error } = await client
    .from("bloom_messages")
    .select("block_data, role")
    .eq("id", args.messageId)
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Ask Bloom action: ${error.message}`);
  if (!isRecord(data) || data.role !== "assistant") return null;
  return findStoredActionCard(data.block_data, args.mutationId);
}

/**
 * Claims the action. The primary key on mutation_id makes this exactly-once:
 * a second approval gets the recorded outcome (or "in progress") instead of
 * running the tool again.
 */
export async function claimAction(
  client: ClaimClient,
  claim: { mutationId: string; tenantId: string; userId: string; conversationId: string; messageId: string; toolName: string },
): Promise<ClaimOutcome> {
  const { error } = await client.from("bloom_action_claims").insert({
    mutation_id: claim.mutationId,
    tenant_id: claim.tenantId,
    user_id: claim.userId,
    conversation_id: claim.conversationId,
    message_id: claim.messageId,
    tool_name: claim.toolName,
    status: "executing",
  });
  if (!error) return { kind: "claimed" };
  if (error.code !== "23505") throw new Error(`Failed to claim Ask Bloom action: ${error.message}`);

  const { data, error: readError } = await client
    .from("bloom_action_claims")
    .select("status, result, tenant_id")
    .eq("mutation_id", claim.mutationId)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read Ask Bloom action claim: ${readError.message}`);
  if (!isRecord(data) || data.tenant_id !== claim.tenantId) return { kind: "in_progress" };
  if (data.status === "completed") {
    return { kind: "already_done", status: "completed", result: typeof data.result === "string" ? data.result : null };
  }
  if (data.status === "failed") {
    // A failed attempt changed nothing, so the person may try again. Re-claiming
    // is conditional on the row still being "failed", so two retries cannot both win.
    const { data: reclaimed, error: retryError } = await client
      .from("bloom_action_claims")
      .update({ status: "executing", result: null, finished_at: null })
      .eq("mutation_id", claim.mutationId)
      .eq("tenant_id", claim.tenantId)
      .eq("status", "failed")
      .select("mutation_id");
    if (retryError) throw new Error(`Failed to retry Ask Bloom action: ${retryError.message}`);
    return Array.isArray(reclaimed) && reclaimed.length === 1 ? { kind: "claimed" } : { kind: "in_progress" };
  }
  return { kind: "in_progress" };
}

export async function finishClaim(
  client: ClaimClient,
  mutationId: string,
  status: "completed" | "failed",
  result: string | null,
): Promise<void> {
  const { error } = await client
    .from("bloom_action_claims")
    .update({ status, result, finished_at: new Date().toISOString() })
    .eq("mutation_id", mutationId)
    .eq("status", "executing");
  if (error) throw new Error(`Failed to record Ask Bloom action outcome: ${error.message}`);
}
