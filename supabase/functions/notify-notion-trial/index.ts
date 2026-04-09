import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findNotionRecord,
  updateNotionRecord,
  createNotionRecord,
} from "../_shared/notion-client.ts";

/**
 * notify-notion-trial
 *
 * Called by a Supabase database webhook (pg_net) after a new user signs up.
 * Looks up (or creates) the matching Notion CRM pipeline row via the shared
 * notion-client helper, then fires a welcome email via Resend.
 */

interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  tenant_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Support both direct POST and Supabase webhook format (record nested under .record)
    const user: UserPayload = payload.record ?? payload;

    if (!user.email) {
      console.error("notify-notion-trial: missing email in payload", payload);
      return new Response(
        JSON.stringify({ error: "Missing email in payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUserId = user.id;
    const userEmail = user.email;
    const today = new Date().toISOString().split("T")[0];

    // Preserve existing logic: resolve tenant_id so other functions can still match on it
    let tenantId = user.tenant_id || "";
    if (!tenantId && supabaseUserId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey);
          const { data } = await sb
            .from("users")
            .select("tenant_id")
            .eq("id", supabaseUserId)
            .maybeSingle();
          tenantId = data?.tenant_id ?? "";
        }
      } catch (e) {
        console.warn("notify-notion-trial: could not resolve tenant_id", e);
      }
    }

    const sharedFields: Record<string, unknown> = {
      "External ID": {
        rich_text: [{ text: { content: supabaseUserId } }],
      },
      "CASL Consent": { checkbox: true },
      "CASL Consent Date": { date: { start: today } },
      "Trial Start Date": { date: { start: today } },
      "Stage": { select: { name: "Trial" } },
    };

    const pageId = await findNotionRecord(supabaseUserId, userEmail);

    let resultPageId: string | null = null;

    if (pageId) {
      const ok = await updateNotionRecord(
        pageId,
        sharedFields,
        "notify-notion-trial:update",
      );
      if (!ok) {
        return new Response(
          JSON.stringify({ error: "Notion update failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      resultPageId = pageId;
      console.log("notify-notion-trial: updated Notion page", pageId);
    } else {
      const createProps: Record<string, unknown> = {
        ...sharedFields,
        "Garden Center": {
          title: [{ text: { content: userEmail } }],
        },
        // Preserved from existing logic — sensible defaults for a new trial record
        "Primary Contact": {
          rich_text: [{ text: { content: user.name || "" } }],
        },
        "Next Action": {
          rich_text: [
            { text: { content: "Trial started — follow up within 48 hours" } },
          ],
        },
        "Assigned To": { select: { name: "Jon" } },
        ...(tenantId
          ? {
              "Supabase Tenant ID": {
                rich_text: [{ text: { content: tenantId } }],
              },
            }
          : {}),
      };

      const newId = await createNotionRecord(
        createProps,
        "notify-notion-trial:create",
      );
      if (!newId) {
        return new Response(
          JSON.stringify({ error: "Notion create failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      resultPageId = newId;
      console.log("notify-notion-trial: created Notion page", newId);
    }

    // Send welcome email — failure here must NOT block the Notion write
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.warn("notify-notion-trial: RESEND_API_KEY not set, skipping welcome email");
      } else {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "BloomSuite <hello@brandsinblooms.com>",
            to: userEmail,
            subject: "Your BloomSuite access is ready",
            html: `<h2>Welcome to BloomSuite</h2>
         <p>Your account is set up and ready to go.</p>
         <p><strong><a href="https://app.bloomsuite.app">Log in to BloomSuite →</a></strong></p>
         <h3>What happens next:</h3>
         <ol>
           <li>Log in and complete your brand profile</li>
           <li>Connect your social media accounts</li>
           <li>Book your kickoff call with our team</li>
         </ol>
         <p>Questions? Reply to this email or visit our <a href="https://bloomsuite.notion.site/bloomsuite-help">knowledge base</a>.</p>
         <p>Jeff and Jon<br>BloomSuite Team</p>`,
          }),
        });
        if (!emailRes.ok) {
          const body = await emailRes.text();
          console.error(
            "notify-notion-trial: Resend email failed",
            emailRes.status,
            body,
          );
        } else {
          console.log("notify-notion-trial: welcome email sent to", userEmail);
        }
      }
    } catch (e) {
      console.error("notify-notion-trial: welcome email error", e);
    }

    return new Response(
      JSON.stringify({ success: true, notion_page_id: resultPageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("notify-notion-trial: unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
