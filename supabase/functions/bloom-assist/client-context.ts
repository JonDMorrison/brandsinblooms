import type { BloomClientContext } from "./types.ts";

const MAX_ROUTE_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 300;
const VIEWPORT_PATTERN = /^\d{1,5}x\d{1,5}$/;

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Optional, size-limited browser facts for support reports. Anything malformed
 * is dropped instead of failing the chat request: these are diagnostics only,
 * never used for authorization.
 */
export function parseClientContext(value: unknown): BloomClientContext | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const route = boundedString(raw.route, MAX_ROUTE_LENGTH);
  const userAgent = boundedString(raw.user_agent, MAX_USER_AGENT_LENGTH);
  const viewportText = boundedString(raw.viewport, 11);
  const viewport = viewportText && VIEWPORT_PATTERN.test(viewportText) ? viewportText : null;
  if (!route && !userAgent && !viewport) return null;
  return {
    route: route && route.startsWith("/") ? route.split(/[?#]/)[0] : null,
    user_agent: userAgent,
    viewport,
  };
}
