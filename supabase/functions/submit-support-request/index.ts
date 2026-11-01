import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

// Compatibility bridge for HelpWidget and older authenticated clients.
// Bloom verifies the caller's JWT and derives requester/account identity there.
// Caller-supplied user_email, user_name and tenant_id never select identity.
serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPrelight(req);
  if (cors) return cors;
  if (req.method !== "POST") return corsJsonResponse({ error: "POST only" }, { status: 405 });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return corsJsonResponse({ error: "Authorization required" }, { status: 401 });
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return corsJsonResponse({ error: "Support is temporarily unavailable" }, { status: 503 });
  try {
    const raw = await req.text();
    if (raw.length > 40000) return corsJsonResponse({ error: "Request is too large" }, { status: 413 });
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)
        || typeof input.subject !== "string" || !input.subject.trim() || input.subject.length > 300
        || typeof input.message !== "string" || input.message.trim().length < 10 || input.message.length > 20000) {
      return corsJsonResponse({ error: "Subject and message are required" }, { status: 400 });
    }
    const response = await fetch(`${url}/functions/v1/bloom-support-api/report`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ product: "crm", subject: input.subject.trim(), body: input.message.trim(), context: { source: "legacy_help_widget" } }),
      redirect: "error", signal: AbortSignal.timeout(30000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.number !== "number" || typeof result?.tracking_url !== "string") {
      return corsJsonResponse({ error: "Your message could not be delivered. Please try again." }, { status: response.ok ? 502 : response.status });
    }
    return corsJsonResponse({ success: true, message: "Support request submitted", number: result.number, tracking_url: result.tracking_url });
  } catch {
    return corsJsonResponse({ error: "Your message could not be delivered. Please try again." }, { status: 502 });
  }
});
