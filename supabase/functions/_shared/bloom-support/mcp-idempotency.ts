import { sha256Hex } from "./crypto.ts";

/**
 * These writes create a new durable record. Other MCP writes address an
 * existing resource and are guarded by its state/version (for example an
 * operation can be executed exactly once).
 */
const RECORD_CREATING_TOOLS = new Set(["create_ticket", "reply_to_ticket", "preview_change"]);

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

/** A fallback for older clients that do not implement MCP session headers. */
export async function legacyMcpRequestScope(
  authorization: string,
  userAgent: string,
  now = new Date(),
): Promise<string> {
  const credential = await sha256Hex(`${authorization}\n${userAgent}`);
  // Bound implicit de-duplication for a legacy long-lived API key. Standards-
  // compliant clients use the stable per-connection session id instead.
  return `legacy:${now.toISOString().slice(0, 10)}:${credential.slice(0, 24)}`;
}

export async function deriveMcpIdempotencyKey(input: {
  callerId: string;
  requestScope: string;
  requestId: unknown;
  toolName: string;
  arguments: Record<string, unknown>;
}): Promise<string> {
  const digest = await sha256Hex(JSON.stringify(canonical({
    caller: input.callerId,
    scope: input.requestScope,
    request: input.requestId,
    tool: input.toolName,
    arguments: input.arguments,
  })));
  return `mcp:${digest}`;
}

/**
 * Preserve caller-provided keys. For older OAuth/MCP clients that omit one,
 * derive it from the transport request so a retry after a lost response is the
 * same write, while a later JSON-RPC call remains a new write.
 */
export async function withMcpIdempotency(input: {
  callerId: string;
  requestScope: string;
  requestId: unknown;
  toolName: string;
  arguments: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  if (!RECORD_CREATING_TOOLS.has(input.toolName) || typeof input.arguments.idempotency_key === "string") {
    return input.arguments;
  }
  return {
    ...input.arguments,
    idempotency_key: await deriveMcpIdempotencyKey(input),
  };
}
