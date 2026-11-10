type SecretKeyMap = Record<string, string>;

function configuredSecretKeys(): string[] {
  const keys = new Set<string>();
  const encodedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (encodedKeys) {
    try {
      const parsed = JSON.parse(encodedKeys) as SecretKeyMap;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.length > 0) keys.add(value);
      }
    } catch {
      console.error("SUPABASE_SECRET_KEYS is not valid JSON");
    }
  }

  // Keep the legacy service-role JWT valid during the documented key
  // migration window. It remains server-only and is compared identically.
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRoleKey) keys.add(legacyServiceRoleKey);

  return [...keys];
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

/**
 * Authenticate an internal Edge Function invocation made by pg_net/cron.
 * Modern sb_secret_ keys are opaque, so verify_jwt must remain disabled and
 * callers must send the key in the apikey header.
 */
export function requireInternalApiKey(req: Request): Response | null {
  const suppliedKey = req.headers.get("apikey") ?? "";
  const valid = configuredSecretKeys().some((key) =>
    constantTimeEqual(suppliedKey, key)
  );

  if (valid) return null;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
