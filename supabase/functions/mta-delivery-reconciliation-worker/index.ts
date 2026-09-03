import { createClient } from "npm:@supabase/supabase-js@2";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import { requireInternalApiKey } from "../_shared/requireInternalApiKey.ts";
import {
  extractMtaDeliveryRows,
  normalizeMtaDelivery,
  type MtaDelivery,
} from "../_shared/mtaDeliveryStatus.ts";

const DEFAULT_BASE_URL = "https://api.mobile-text-alerts.com";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 5;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

Deno.serve(async (req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;

  const unauthorized = requireInternalApiKey(req);
  if (unauthorized) return unauthorized;

  const apiKey = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");
  if (!apiKey) {
    return corsJsonResponse({ error: "Mobile Text Alerts is not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const pageSize = boundedInteger(body.pageSize, DEFAULT_PAGE_SIZE, 1, 250);
  const maxPages = boundedInteger(body.maxPages, DEFAULT_MAX_PAGES, 1, 10);
  const workerId = `mta-reconcile-${crypto.randomUUID().slice(0, 8)}`;
  const claimToken = crypto.randomUUID();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: claimRows, error: claimError } = await supabase.rpc(
    "claim_sms_delivery_reconciliation",
    { p_worker_id: workerId, p_claim_token: claimToken, p_stale_minutes: 10 },
  );

  if (claimError) {
    console.error("[mta-delivery-reconciliation] claim failed", claimError);
    return corsJsonResponse({ error: "Unable to claim reconciliation work" }, { status: 500 });
  }

  const claimedPage = Array.isArray(claimRows) ? Number(claimRows[0]?.page) : NaN;
  if (!Number.isInteger(claimedPage) || claimedPage < 1) {
    return corsJsonResponse({ success: true, claimed: false, message: "Another worker is active" });
  }

  let page = claimedPage;
  let cycleComplete = false;
  let pagesProcessed = 0;
  let rowsReceived = 0;
  let validDeliveries = 0;
  const totals = { total: 0, applied: 0, unmatched: 0, duplicates: 0, ignored: 0 };
  const baseUrl = (Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");

  try {
    for (let index = 0; index < maxPages; index += 1) {
      const url = new URL(`${baseUrl}/v3/deliveries`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("sortBy", "date");
      url.searchParams.set("sortDirection", "desc");

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      const responseText = await response.text();
      let payload: unknown = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(`Mobile Text Alerts deliveries returned HTTP ${response.status}`);
      }

      const rows = extractMtaDeliveryRows(payload);
      const deliveries = rows.map(normalizeMtaDelivery).filter(
        (delivery): delivery is MtaDelivery => delivery !== null,
      );
      pagesProcessed += 1;
      rowsReceived += rows.length;
      validDeliveries += deliveries.length;

      if (deliveries.length > 0) {
        const { data: batchResult, error: batchError } = await supabase.rpc(
          "apply_sms_delivery_status_batch",
          { p_deliveries: deliveries, p_source: "reconciliation" },
        );
        if (batchError) throw new Error(`Unable to apply delivery statuses: ${batchError.message}`);

        for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
          totals[key] += Number(batchResult?.[key] ?? 0);
        }
      }

      page += 1;
      if (rows.length < pageSize) {
        cycleComplete = true;
        break;
      }
    }

    const { data: completed, error: completeError } = await supabase.rpc(
      "complete_sms_delivery_reconciliation",
      {
        p_claim_token: claimToken,
        p_next_page: page,
        p_cycle_complete: cycleComplete,
        p_error: null,
      },
    );
    if (completeError || completed !== true) {
      throw new Error(completeError?.message || "Reconciliation claim was lost before completion");
    }

    return corsJsonResponse({
      success: true,
      claimed: true,
      startingPage: claimedPage,
      nextPage: cycleComplete ? 1 : page,
      cycleComplete,
      pagesProcessed,
      rowsReceived,
      validDeliveries,
      ...totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reconciliation failure";
    console.error("[mta-delivery-reconciliation] failed", message);
    await supabase.rpc("complete_sms_delivery_reconciliation", {
      p_claim_token: claimToken,
      p_next_page: page,
      p_cycle_complete: false,
      p_error: message,
    });
    return corsJsonResponse({ error: message }, { status: 502 });
  }
});
