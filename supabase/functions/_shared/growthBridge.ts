/** Narrow server-to-server authentication; public embed keys are not credentials. */
export type GrowthBridgePurpose = "submit-form" | "growth-signup-stats";
export async function verifyGrowthBridge(
  request: Request,
  raw: string,
  purpose: GrowthBridgePurpose,
  secret: string | undefined,
  now = Date.now(),
): Promise<"unsigned" | "valid" | "invalid"> {
  const timestamp = request.headers.get("x-bloomsites-growth-timestamp");
  const signature = request.headers.get("x-bloomsites-growth-signature");
  if (!timestamp && !signature) return "unsigned";
  if (
    !secret || secret.length < 32 || !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    !signature || !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  ) return "invalid";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(
    signature.match(/../g)!,
    (value) => parseInt(value, 16),
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(
      `bloomsites-growth:${purpose}:v1\n${timestamp}\n${raw}`,
    ),
  );
  return valid ? "valid" : "invalid";
}

export function verifiedGrowthVisitor(
  meta: { source?: unknown; site_id?: unknown; bridge_visitor_key?: unknown },
): string | null {
  return meta.source === "bloomsites" && typeof meta.site_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(meta.site_id) &&
      typeof meta.bridge_visitor_key === "string" &&
      /^[a-f0-9]{64}$/.test(meta.bridge_visitor_key)
    ? meta.bridge_visitor_key
    : null;
}

/** Public embed metadata cannot claim the reserved server-authenticated website attribution. */
export function sanitizeGrowthAttribution<
  T extends { source?: string; site_id?: string; bridge_visitor_key?: string },
>(meta: T, authenticated: boolean): T {
  const result = { ...meta };
  if (!authenticated) {
    delete result.site_id;
    delete result.bridge_visitor_key;
    if (result.source?.trim().toLowerCase() === "bloomsites") {
      result.source = "public_embed";
    }
  }
  return result;
}
