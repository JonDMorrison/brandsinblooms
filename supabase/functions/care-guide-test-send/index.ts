/**
 * Care Guide Studio staff test. Sends the tenant's saved Care Guide draft,
 * rendered with the same template customers receive, to the signed-in
 * user's own address only. Uses a clearly marked sample plant. Never
 * reads customers, never changes consent, never publishes.
 */
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { Resend } from "npm:resend@2.1.0";
import { resolveSender } from "../_shared/senderResolver.ts";
import { renderCareGuideEmail, type ReviewedCareGuidePlant } from "../../../src/lib/email/careGuideEmail.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const designKeys = ["storeName", "logoUrl", "primaryColor", "accentColor", "headline", "intro", "helpHeading", "helpBody", "helpUrl", "helpLinkText"] as const;

/** Same illustrative sample the Studio preview shows. Not a product claim. */
const samplePlant: ReviewedCareGuidePlant = {
  productId: "STUDIO-TEST-SAMPLE",
  name: "Red Prayer Plant",
  botanicalName: "Maranta leuconeura",
  careVersion: "studio-sample-v1",
  care: {
    status: "REVIEWED",
    sun: "Bright, filtered light away from harsh direct sun.",
    water: "Check the topsoil. Water as it begins to dry, and let the excess drain.",
    soil: "Use a loose, well-draining potting mix.",
    sourceLabel: "Illustrative studio sample only",
  },
  approvedImageUrl: "https://images.pexels.com/photos/4590439/pexels-photo-4590439.jpeg?auto=compress&cs=tinysrgb&w=900",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!bearer || !url || !anon) return reply({ error: "Sign in to send a test." }, 401);
  if (!resendKey) return reply({ error: "Email sending is not configured." }, 503);
  try {
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: "Bearer " + bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: { user }, error: userError }, { data: access, error: accessError }] = await Promise.all([
      authed.auth.getUser(bearer),
      authed.rpc("get_current_crm_access"),
    ]);
    if (userError || !user?.email || accessError || !access || typeof access.tenantId !== "string" || !uuid.test(access.tenantId) ||
      !Array.isArray(access.permissions) || !access.permissions.includes("campaigns.write")) {
      return reply({ error: "Care Guide editing permission is required." }, 403);
    }
    const tenantId = access.tenantId;
    const saved = await authed.from("care_guide_designs").select("draft").eq("tenant_id", tenantId).maybeSingle();
    if (saved.error) return reply({ error: "Your saved design could not be loaded." }, 503);
    const draft = (saved.data?.draft ?? {}) as Record<string, unknown>;
    const brand: Record<string, string> = {};
    for (const key of designKeys) if (typeof draft[key] === "string") brand[key] = draft[key] as string;
    if (!brand.storeName?.trim()) return reply({ error: "Save a design with your store name first." }, 409);

    const rendered = renderCareGuideEmail({
      brand: { ...brand, storeName: brand.storeName, publishedVersion: "STUDIO-TEST" },
      plants: [samplePlant],
      requested: true,
    });
    const sender = await resolveSender(authed, tenantId, { userId: user.id });
    const fromName = (brand.storeName || "BloomSuite").replace(/[<>"\r\n]/g, "").slice(0, 80);
    const from = sender ? `${fromName} <${sender.fromEmail}>` : `${fromName} <hello@notify.bloomsuite.app>`;
    const resend = new Resend(resendKey);
    const sent = await resend.emails.send({
      from,
      replyTo: sender?.replyTo || user.email,
      to: [user.email],
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    if (sent.error || !sent.data?.id) return reply({ error: "The test email was not accepted. Try again in a moment." }, 502);
    await authed.from("email_test_sends").insert({
      tenant_id: tenantId,
      user_id: user.id,
      to_email: user.email,
      subject: rendered.subject,
      status: "sent",
      diagnostics: { kind: "care_guide_studio_test", templateVersion: rendered.templateVersion },
    });
    return reply({ sent: true, to: user.email, emailId: sent.data.id });
  } catch {
    return reply({ error: "The test email could not be prepared. Check your design and try again." }, 503);
  }
});
