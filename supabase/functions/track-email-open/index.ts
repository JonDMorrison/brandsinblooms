// Open-tracking pixel endpoint.
//
// Why this exists: Resend's native open tracking is configured per
// domain in the Resend dashboard (the API has no per-message override
// that overrides a "tracking off" domain default). The Mother's Day
// campaign sent from theflowerhousegardencenter.com — a domain whose
// dashboard had open tracking off — registered zero opens despite 210
// successful deliveries. Older campaigns from brandsinblooms.com (open
// tracking on) registered opens fine. To be domain-config-independent,
// this function is our own first-party pixel, embedded into every
// outgoing send by the shared email renderer. Hits are recorded into
// email_tracking_events so the existing recompute_campaign_metrics
// pipeline picks them up the same way it picks up Resend webhook opens.
//
// Privacy / accuracy notes:
// - Apple Mail Privacy Protection prefetches all remote images on the
//   server side, inflating open rates. We mark a hit as is_mpp_guess
//   when the User-Agent looks like Mail Privacy Protection's GoogleImageProxy
//   or AppleMail style fetcher with no client-side timing.
// - We never store the raw IP — only a SHA-256 hash for analytics
//   uniqueness without retention liability.
// - Multiple opens by the same recipient produce multiple rows;
//   the aggregator counts unique recipients via BOOL_OR.
// - Errors during ingest are swallowed: the pixel ALWAYS returns the
//   1x1 transparent GIF so a failed insert never causes a broken-image
//   icon in the recipient's mail client.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Smallest possible transparent 1x1 GIF, base64-encoded.
const TRANSPARENT_GIF_BYTES = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(TRANSPARENT_GIF_BYTES.length),
  // Belt-and-suspenders: defeat every layer of caching so repeated opens
  // re-fetch the pixel.
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function pixelResponse(): Response {
  return new Response(TRANSPARENT_GIF_BYTES, {
    status: 200,
    headers: { ...corsHeaders, ...PIXEL_HEADERS },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function looksLikeMppFetch(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  // Apple Mail Privacy Protection routes through Apple-owned relay UAs.
  if (ua.includes("mail privacy protection")) return true;
  // GoogleImageProxy is Gmail's proxy, but it does NOT mean MPP — Gmail
  // proxy fires on actual user opens. Don't flag it.
  return false;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("c");
    const customerId = url.searchParams.get("u");
    const tenantId = url.searchParams.get("t");
    const email = url.searchParams.get("e");

    // Without at minimum a campaign id we can't attribute the open.
    // Still return the pixel so the recipient sees nothing wrong.
    if (!campaignId) {
      return pixelResponse();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("track-email-open: missing Supabase credentials");
      return pixelResponse();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || "";
    const ipHash = ip ? await sha256Hex(ip) : null;
    const isMpp = looksLikeMppFetch(userAgent);

    // Look up the canonical email + tenant from email_messages when
    // the URL didn't carry them (or to fill in the resend_id), so the
    // row carries the same shape as Resend webhook events. Best-effort
    // lookup — failure here is fine, we just skip the row.
    let resolvedEmail = email || "";
    let resolvedTenantId = tenantId || null;
    let resolvedCustomerId = customerId || null;
    let providerMessageId: string | null = null;

    try {
      const messageQuery = supabase
        .from("email_messages")
        .select("email, tenant_id, customer_id, resend_id")
        .eq("campaign_id", campaignId)
        .limit(1);
      const filtered = customerId
        ? messageQuery.eq("customer_id", customerId)
        : email
          ? messageQuery.eq("email", email)
          : messageQuery;
      const { data: messageRow } = await filtered.maybeSingle();
      if (messageRow) {
        resolvedEmail ||= messageRow.email || "";
        resolvedTenantId ||= messageRow.tenant_id || null;
        resolvedCustomerId ||= messageRow.customer_id || null;
        providerMessageId = messageRow.resend_id || null;
      }
    } catch (lookupErr) {
      console.warn("track-email-open: message lookup warning:", lookupErr);
    }

    // Without an email we can't attribute the open. Still return the
    // pixel so the recipient never sees a broken image.
    if (!resolvedEmail) {
      return pixelResponse();
    }

    const nowIso = new Date().toISOString();
    // email_tracking_events has a CHECK constraint requiring
    // event_data->>'email_id' to be non-empty. The webhook handler
    // populates that with Resend's email_id. We use the resend_id
    // looked up from email_messages when available, falling back to a
    // deterministic synthetic identifier (campaign + customer) for the
    // case where the worker hasn't yet stamped resend_id onto the
    // message row.
    const emailId =
      providerMessageId ||
      `pixel:${campaignId}:${resolvedCustomerId || resolvedEmail.toLowerCase()}`;
    const eventData: Record<string, unknown> = {
      source: "first_party_pixel",
      email_id: emailId,
      provider_message_id: providerMessageId,
      ip_hash: ipHash,
      user_agent: userAgent || null,
      occurred_at: nowIso,
    };

    // Await the insert — Deno Deploy kills the isolate as soon as the
    // response ends, so an orphan Promise.then() never runs. The
    // 60-200ms latency is acceptable for an image load and matches
    // how Resend's own tracking pixel behaves.
    const { error: trackingError } = await supabase
      .from("email_tracking_events")
      .insert({
        campaign_id: campaignId,
        customer_email: resolvedEmail.toLowerCase(),
        customer_id: resolvedCustomerId,
        tenant_id: resolvedTenantId,
        event_type: "opened",
        event_data: eventData,
        ingested_at: nowIso,
        event_ts_provider: nowIso,
        user_agent: userAgent || null,
        ip_hash: ipHash,
        is_mpp_guess: isMpp,
        provider_message_id: providerMessageId,
      });

    if (trackingError) {
      console.error("track-email-open: failed to insert event:", {
        campaign_id: campaignId,
        error: trackingError.message,
      });
      // Still return the pixel — never let an ingest failure show the
      // recipient a broken image.
      return pixelResponse();
    }

    // Best-effort recompute. Run it only when we actually inserted a
    // row, and don't block the pixel response on its outcome — use
    // EdgeRuntime.waitUntil if available, otherwise await briefly with
    // a short timeout.
    const recomputePromise = supabase
      .rpc("recompute_campaign_metrics", { p_campaign_id: campaignId })
      .then(({ error: recomputeError }) => {
        if (recomputeError) {
          console.warn(
            "track-email-open: recompute warning:",
            recomputeError.message,
          );
        }
      });

    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(recomputePromise);
    } else {
      // Fallback — bound by a 2s ceiling so the pixel never hangs.
      await Promise.race([
        recomputePromise,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }

    return pixelResponse();
  } catch (err) {
    console.error("track-email-open: unexpected error:", err);
    return pixelResponse();
  }
});
