import { sha256Hex } from "./crypto.ts";
import { BloomError } from "./runtime.ts";

/** Native handlers that also accept the durable key for their own ledger. */
const NATIVE_IDEMPOTENCY_TOOLS = new Set(["create_ticket", "reply_to_ticket", "preview_change"]);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

export function normalizeMcpSessionId(value: string | null): string | null {
  if (!value || !/^[A-Za-z0-9._~-]{16,160}$/.test(value)) return null;
  return value;
}

function withoutExplicitKey(arguments_: Record<string, unknown>): Record<string, unknown> {
  const { idempotency_key: _ignored, ...rest } = arguments_;
  return rest;
}

export interface PreparedMcpMutation {
  arguments: Record<string, unknown>;
  requestKey: string;
  argumentsHash: string;
}

/**
 * Creates the identity used by the database-backed mutation receipt.
 *
 * A caller-provided key deliberately survives reconnects. Otherwise a valid,
 * server-issued MCP session is mandatory: JSON-RPC ids are only unique inside
 * that session, and an OAuth access-token refresh must not change the identity.
 */
export async function prepareMcpMutation(input: {
  callerId: string;
  sessionId: string | null;
  requestId: unknown;
  toolName: string;
  arguments: Record<string, unknown>;
}): Promise<PreparedMcpMutation> {
  const hasExplicit = Object.hasOwn(input.arguments, "idempotency_key");
  const candidate = input.arguments.idempotency_key;
  if (hasExplicit && (typeof candidate !== "string" || !candidate.trim() || candidate.length > 200)) {
    throw new BloomError(400, "invalid", "idempotency_key must be a nonblank string of 200 characters or fewer");
  }
  // Keep the exact caller value in the outer identity. Whitespace is data;
  // silently normalizing it would make two different keys replay one receipt.
  const explicit = hasExplicit ? candidate as string : null;
  if (!explicit && !input.sessionId) {
    throw new BloomError(409, "session_required", "Reinitialize the MCP connection before changing data, or provide idempotency_key.");
  }
  const semanticArguments = canonical(withoutExplicitKey(input.arguments));
  const argumentsHash = await sha256Hex(JSON.stringify(semanticArguments));
  const identity = explicit
    ? { caller: input.callerId, explicit, tool: input.toolName }
    : { caller: input.callerId, session: input.sessionId, request: input.requestId, tool: input.toolName };
  const requestKey = `mcp:${await sha256Hex(JSON.stringify(canonical(identity)))}`;
  return {
    // Native ledgers historically accepted a globally unique caller key.
    // Always replace it with the caller-scoped outer receipt key so an
    // explicit key cannot collide across principals or bypass payload checks.
    arguments: NATIVE_IDEMPOTENCY_TOOLS.has(input.toolName)
      ? { ...input.arguments, idempotency_key: requestKey }
      : input.arguments,
    requestKey,
    argumentsHash,
  };
}

/** Adds the optional explicit retry key to every advertised write-tool schema. */
export function mutationInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {};
  return {
    ...schema,
    properties: {
      ...properties,
      idempotency_key: properties.idempotency_key ?? {
        type: "string",
        maxLength: 200,
        description: "Optional stable retry key, retained for 30 days. Reuse only for the exact same mutation.",
      },
    },
  };
}
