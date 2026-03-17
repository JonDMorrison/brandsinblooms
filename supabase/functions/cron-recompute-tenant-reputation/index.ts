// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-task-signature",
};

function truncateError(message: string, maxLength: number = 500): string {
  if (!message) return '';
  return message.length > maxLength ? message.slice(0, maxLength) : message;
}

async function dispatchTenantHardStopNotifications(
  supabase: any,
  resendApiKey: string,
  workerId: string,
  limit: number = 50,
): Promise<{ claimed: number; sent: number; failed: number }> {
  const { data, error } = await supabase.rpc('claim_tenant_hard_stop_notifications', {
    p_limit: limit,
    p_worker_id: workerId,
    p_stale_after_minutes: 10,
  });

  if (error) {
    console.warn('Failed to claim hard-stop notifications:', error.message);
    return { claimed: 0, sent: 0, failed: 0 };
  }

  const notifications = Array.isArray(data) ? data : [];
  if (notifications.length === 0) {
    return { claimed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const notificationId = String(notification?.id || '');
    const to = String(notification?.recipient_email || '').trim();
    const subject = String(notification?.subject || 'Sending paused: tenant under review');
    const bodyText = String(notification?.body_text || 'Your tenant is under review and campaign sending is paused.');

    if (!notificationId || !to) {
      failed += 1;
      continue;
    }

    try {
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'BloomSuite Deliverability <noreply@brandsinblooms.com>',
          to: [to],
          subject,
          text: bodyText,
        }),
      });

      if (!resendResp.ok) {
        const errText = await resendResp.text();
        throw new Error(`Resend ${resendResp.status}: ${truncateError(errText || 'unknown error')}`);
      }

      await supabase
        .from('email_governance_tenant_hard_stop_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (notification?.enforcement_action_id) {
        await supabase
          .from('email_governance_tenant_enforcement_actions')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', notification.enforcement_action_id)
          .is('notified_at', null);
      }

      sent += 1;
    } catch (sendError: any) {
      await supabase
        .from('email_governance_tenant_hard_stop_notifications')
        .update({
          status: 'pending',
          error_message: truncateError(sendError?.message || 'Failed to send hard-stop notification'),
          claim_token: null,
          claimed_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId);
      failed += 1;
    }
  }

  return { claimed: notifications.length, sent, failed };
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload));
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const cronSecret = Deno.env.get('CRON_SIGNING_SECRET');
    if (cronSecret) {
      const signature = req.headers.get('x-task-signature');
      const currentHour = new Date().toISOString().slice(0, 13);
      const payload = `cron-recompute-tenant-reputation:${currentHour}`;

      if (!signature) {
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isCurrentValid = await verifySignature(payload, signature, cronSecret);
      if (!isCurrentValid) {
        const previousHour = new Date(Date.now() - 3600000).toISOString().slice(0, 13);
        const previousPayload = `cron-recompute-tenant-reputation:${previousHour}`;
        const isPreviousValid = await verifySignature(previousPayload, signature, cronSecret);

        if (!isPreviousValid) {
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const pageSize = Math.max(1, Math.min(Number(body?.page_size || 200), 1000));
    const maxPages = Math.max(1, Math.min(Number(body?.max_pages || 500), 5000));
    const asOf = body?.as_of ? new Date(body.as_of).toISOString() : new Date().toISOString();

    let processed = 0;
    let failed = 0;
    let pages = 0;
    let hardStopsTriggered = 0;
    const failures: Array<{ tenant_id: string | null; error: string | null }> = [];

    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;

      const { data, error } = await supabase.rpc('refresh_email_governance_all_tenant_reputation_scores', {
        p_as_of: asOf,
        p_limit: pageSize,
        p_offset: offset,
      });

      if (error) {
        console.error('RPC error:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        break;
      }

      pages++;

      for (const row of rows) {
        if (row?.error) {
          failed += 1;
          failures.push({ tenant_id: row?.tenant_id || null, error: row?.error || null });
        } else {
          processed += 1;

          if (row?.tenant_id) {
            const { data: hardStopData, error: hardStopError } = await supabase.rpc('maybe_enforce_tenant_hard_stop', {
              p_tenant_id: row.tenant_id,
              p_source: 'reputation_cron',
              p_as_of: asOf,
            });

            if (hardStopError) {
              failed += 1;
              failures.push({ tenant_id: row?.tenant_id || null, error: hardStopError.message || 'Hard-stop enforcement failed' });
            } else {
              const hardStopRow = Array.isArray(hardStopData) ? hardStopData[0] : hardStopData;
              if (hardStopRow?.triggered) {
                hardStopsTriggered += 1;
              }
            }
          }
        }
      }

      if (rows.length < pageSize) {
        break;
      }
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    let hardStopNotifications = { claimed: 0, sent: 0, failed: 0 };
    if (resendApiKey) {
      hardStopNotifications = await dispatchTenantHardStopNotifications(
        supabase,
        resendApiKey,
        'cron-recompute-tenant-reputation',
        100,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        as_of: asOf,
        processed,
        failed,
        pages,
        hard_stops_triggered: hardStopsTriggered,
        hard_stop_notifications: hardStopNotifications,
        duration_ms: Date.now() - startedAt,
        failures: failures.slice(0, 100),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('cron-recompute-tenant-reputation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
