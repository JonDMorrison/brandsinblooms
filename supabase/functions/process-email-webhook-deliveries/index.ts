// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GovernanceWebhookDelivery = {
  id: string;
  tenant_id: string;
  provider: string;
  delivery_id: string;
  event_type: string | null;
  provider_message_id: string | null;
  campaign_id: string | null;
  domain_id: string | null;
  retry_count: number;
  max_retries: number;
  raw_payload: Record<string, unknown>;
  headers: Record<string, unknown>;
};

const scheduleRetryOrDeadLetter = async (
  supabase: ReturnType<typeof createClient>,
  delivery: GovernanceWebhookDelivery,
  stage: string,
  errorMessage: string,
) => {
  const currentRetryCount = Number(delivery.retry_count || 0);
  const maxRetries = Number(delivery.max_retries || 8);

  if (currentRetryCount >= maxRetries) {
    const nowIso = new Date().toISOString();

    await supabase
      .from("email_governance_webhook_deliveries")
      .update({
        processing_status: "dead_lettered",
        dead_lettered_at: nowIso,
        dead_letter_reason: `${stage}: ${errorMessage}`,
        error_message: errorMessage,
        processed_at: nowIso,
        claimed_at: null,
        claimed_by: null,
        claim_token: null,
      })
      .eq("id", delivery.id);

    await supabase
      .from("email_governance_webhook_dead_letters")
      .upsert(
        {
          tenant_id: delivery.tenant_id,
          webhook_delivery_id: delivery.id,
          provider: delivery.provider,
          delivery_id: delivery.delivery_id,
          event_type: delivery.event_type,
          provider_message_id: delivery.provider_message_id,
          campaign_id: delivery.campaign_id,
          domain_id: delivery.domain_id,
          failure_stage: stage,
          retry_count: currentRetryCount,
          max_retries: maxRetries,
          last_error_message: errorMessage,
          raw_payload: delivery.raw_payload || {},
          headers: delivery.headers || {},
          dead_lettered_at: nowIso,
        },
        { onConflict: "webhook_delivery_id" },
      );

    return;
  }

  const backoffMinutes = Math.pow(2, Math.max(0, currentRetryCount - 1));
  const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  await supabase
    .from("email_governance_webhook_deliveries")
    .update({
      processing_status: "retrying",
      next_retry_at: nextRetryAt,
      error_message: errorMessage,
      processed_at: null,
      claimed_at: null,
      claimed_by: null,
      claim_token: null,
    })
    .eq("id", delivery.id);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const webhookRetryToken = Deno.env.get("WEBHOOK_RETRY_TOKEN");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.max(1, Math.min(Number(body?.batch_size || 50), 200));
  const workerId = `email-webhook-worker-${crypto.randomUUID().slice(0, 8)}`;

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_email_governance_webhook_deliveries",
    {
      p_batch_size: batchSize,
      p_worker_id: workerId,
      p_claim_token: crypto.randomUUID(),
      p_stale_after_minutes: 10,
    },
  );

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const deliveries = (claimed || []) as GovernanceWebhookDelivery[];
  if (deliveries.length === 0) {
    return new Response(JSON.stringify({ success: true, claimed: 0, processed: 0, retried: 0, dead_lettered: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let processed = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const delivery of deliveries) {
    try {
      const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/email-tracking-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "x-webhook-retry-token": webhookRetryToken || "",
          "x-retry-worker": "process-email-webhook-deliveries",
          "x-retry-delivery-id": delivery.delivery_id,
          "svix-id": delivery.delivery_id,
          "svix-timestamp": `${Math.floor(Date.now() / 1000)}`,
        },
        body: JSON.stringify(delivery.raw_payload || {}),
      });

      if (webhookResponse.ok) {
        processed += 1;
        continue;
      }

      const responseText = await webhookResponse.text();
      await scheduleRetryOrDeadLetter(
        supabase,
        delivery,
        "retry_worker_invoke",
        `Webhook returned ${webhookResponse.status}: ${responseText.slice(0, 500)}`,
      );

      if (delivery.retry_count >= delivery.max_retries) {
        deadLettered += 1;
      } else {
        retried += 1;
      }
    } catch (error: any) {
      await scheduleRetryOrDeadLetter(
        supabase,
        delivery,
        "retry_worker_exception",
        error?.message || "Unknown retry worker error",
      );

      if (delivery.retry_count >= delivery.max_retries) {
        deadLettered += 1;
      } else {
        retried += 1;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      claimed: deliveries.length,
      processed,
      retried,
      dead_lettered: deadLettered,
      worker_id: workerId,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
