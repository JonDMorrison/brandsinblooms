/**
 * Synthetic data for the CRM showroom: "Greenfield Garden Centre", the same fictional
 * business as supabase/seeds/demo-tenant-greenfield.sql. Every person, email and number
 * is invented. Emails use reserved example domains. Generated deterministically so every
 * visitor starts from the same pristine workspace.
 */
import type { Row } from "./engine";

export const SHOWROOM_TENANT_ID = "6f1c2c1e-9f6b-4c1a-8d7e-5a0d3c1e0001";
export const SHOWROOM_USER_ID = "6f1c2c1e-9f6b-4c1a-8d7e-5a0d3c1e0002";
export const SHOWROOM_USER_EMAIL = "owner@greenfield-demo.example";
export const SHOWROOM_BUSINESS = "Greenfield Garden Centre";

const DAY = 86_400_000;
/** Data is anchored to the visit so "last 30 days" always has activity. */
const NOW = Date.now();
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const dateOnly = (daysAgo: number) => iso(daysAgo).slice(0, 10);

function prng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const rand = prng(20261124);
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const id = (prefix: number, n: number) => `6f1c2c1e-9f6b-4c1a-${String(prefix).padStart(4, "0")}-${String(n).padStart(12, "0")}`;

const FIRST = ["Sarah","Emma","Olivia","Sophia","Ava","Mia","Charlotte","Amelia","Liam","Noah","Ethan","Lucas","Benjamin","Jacob","Owen","Nathan","Grace","Hannah","Chloe","Zoe","Leah","Isla","Maya","Priya","Aiden","Daniel","Samuel","Theo","Ruth","Linnea","David","Tom","Eleanor","Harper","Jasmine","Kenji","Arjun","Mateo","Sofia","Nora"];
const LAST = ["Tremblay","Wilson","Martin","Brown","Smith","Roy","Lee","Anderson","Taylor","Campbell","Fernwood","Okafor","Park","Desai","Hallett","Chen","Nguyen","Singh","MacDonald","Gagnon","Fraser","Bloom","Patel","Murray","Reid","Kowalski","Dubois","Laurent","Hughes","Sato"];
const CITIES = ["Vancouver","Burnaby","Surrey","Langley","Abbotsford","Chilliwack","Richmond","Coquitlam","Maple Ridge","Mission"];
const INTERESTS = ["houseplants","vegetables","perennials","trees & shrubs","natives","containers","roses","herbs","succulents","pollinators"];
const PERSONAS = ["Weekend Gardener","Houseplant Enthusiast","Edible Gardener","Landscape Pro","Gift Shopper"];

export type ShowroomSeed = Record<string, Row[]>;

export function buildSeed(customerCount = 1200): ShowroomSeed {
  const customers: Row[] = [];
  const named: [string, string, string, string[], number][] = [
    ["Sarah", "Bloom", "sarah@bloom.example", ["houseplants", "trees & shrubs", "loyalty"], 1842.5],
    ["Maya", "Fernwood", "maya.fernwood@example.com", ["houseplants", "workshops", "loyalty"], 964.2],
    ["David", "Okafor", "d.okafor@example.com", ["vegetables", "herbs"], 612.75],
    ["Linnea", "Park", "linnea.park@example.com", ["containers", "gift"], 318.4],
    ["Tom", "Hallett", "hallett.family@example.com", ["natives", "pollinators", "loyalty"], 2210.0],
    ["Priya", "Desai", "priya.d@example.com", ["containers", "succulents"], 241.9],
  ];
  for (let n = 0; n < customerCount; n++) {
    const preset = named[n];
    const first = preset?.[0] ?? pick(FIRST);
    const last = preset?.[1] ?? pick(LAST);
    const createdDaysAgo = Math.floor(Math.pow(rand(), 1.4) * 540);
    const purchased = preset ? true : rand() < 0.68;
    const lastPurchase = purchased ? Math.min(createdDaysAgo, Math.floor(rand() * (rand() < 0.6 ? 120 : 420))) : null;
    const orders = purchased ? 1 + Math.floor(Math.pow(rand(), 2) * 14) : 0;
    const spent = preset?.[4] ?? (purchased ? Math.round(orders * (28 + rand() * 90) * 100) / 100 : 0);
    const tags = preset?.[3] ?? Array.from(new Set([pick(INTERESTS), ...(rand() < 0.45 ? [pick(INTERESTS)] : []), ...(rand() < 0.4 ? ["loyalty"] : [])]));
    const emailOptIn = preset ? true : rand() < 0.78;
    const sent = emailOptIn ? 4 + Math.floor(rand() * 30) : 0;
    const opened = Math.floor(sent * (0.22 + rand() * 0.3));
    const clicked = Math.floor(opened * (0.1 + rand() * 0.25));
    customers.push({
      id: id(1, n + 1), tenant_id: SHOWROOM_TENANT_ID, user_id: SHOWROOM_USER_ID,
      first_name: first, last_name: last,
      email: preset?.[2] ?? `${first}.${last}.${n + 1}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@greenfield-demo.example",
      phone: rand() < 0.6 || preset ? `604-555-${String(1000 + n).slice(-4)}` : null,
      city: pick(CITIES), state_region: "BC", country_code: "CA", postal_code: null, timezone: "America/Vancouver",
      created_at: iso(createdDaysAgo), updated_at: iso(Math.min(createdDaysAgo, lastPurchase ?? createdDaysAgo)), deleted_at: null,
      email_opt_in: emailOptIn, email_opt_in_at: emailOptIn ? iso(createdDaysAgo) : null, email_consent_source: emailOptIn ? pick(["pos_signup", "website_form", "loyalty_signup"]) : null,
      sms_opt_in: rand() < 0.3, opt_out: false, suppressed: false,
      first_purchase_date: purchased ? dateOnly(createdDaysAgo) : null, last_purchase_date: lastPurchase === null ? null : dateOnly(lastPurchase),
      pos_order_count: orders, total_spent: spent, pos_total_spent: spent, lifetime_value: spent,
      is_vip: spent > 1200, tags, product_tags: tags.filter(t => t !== "loyalty"),
      persona: pick(PERSONAS), preferred_channel: emailOptIn ? "email" : "in_store",
      total_emails_sent: sent, total_emails_delivered: sent, total_emails_opened: opened, total_emails_clicked: clicked,
      email_open_rate: sent ? Math.round((opened / sent) * 1000) / 10 : null, email_click_rate: sent ? Math.round((clicked / sent) * 1000) / 10 : null,
      email_engagement_score: sent ? Math.round((opened / sent) * 70 + (clicked / Math.max(opened, 1)) * 30) : null,
      last_open_at: opened ? iso(Math.floor(rand() * 60)) : null, signup_source: pick(["In store", "Website", "Workshop", "Loyalty"]),
      store_name: "Greenfield Garden Centre", custom_fields: {}, order_history: null,
    });
  }

  const segmentDefs: [string, string, (c: Row) => boolean][] = [
    ["Houseplant enthusiasts", "Customers who buy houseplants, pots and indoor care.", c => (c.tags as string[]).includes("houseplants")],
    ["Vegetable gardeners", "Edible gardeners who buy starts, seed potatoes and soil.", c => (c.tags as string[]).some(t => t === "vegetables" || t === "herbs")],
    ["High-value customers", "Spent more than $1,200 with us.", c => Number(c.total_spent) > 1200],
    ["Spring shoppers", "Bought something in the last 120 days.", c => c.last_purchase_date !== null && Date.parse(String(c.last_purchase_date)) > NOW - 120 * DAY],
    ["Loyalty members", "Members of Greenfield Rewards.", c => (c.tags as string[]).includes("loyalty")],
    ["Haven't visited recently", "No purchase in the last 9 months.", c => c.last_purchase_date !== null && Date.parse(String(c.last_purchase_date)) < NOW - 270 * DAY],
  ];
  const segments: Row[] = [], memberships: Row[] = [];
  segmentDefs.forEach(([name, description, test], index) => {
    const segmentId = id(2, index + 1);
    const members = customers.filter(test);
    segments.push({ id: segmentId, tenant_id: SHOWROOM_TENANT_ID, user_id: SHOWROOM_USER_ID, name, description, status: "active", source: "manual", auto_update: false, is_system_segment: false, include_all_customers: false, conditions: { demo: true }, customer_count: members.length, created_at: iso(200 - index * 20), updated_at: iso(3), deleted_at: null, persona_id: null, source_id: null });
    for (const member of members) memberships.push({ id: `${segmentId}:${member.id}`, segment_id: segmentId, customer_id: member.id, tenant_id: SHOWROOM_TENANT_ID, added_at: iso(3), created_at: iso(3) });
  });

  const optedIn = customers.filter(c => c.email_opt_in).length;
  const campaign = (n: number, name: string, status: string, subject: string, daysAgo: number, openRate: number | null, clickRate: number | null, segment: number | null, html: string): Row => {
    const sent = status === "sent" ? Math.round(optedIn * (segment ? 0.35 : 0.96)) : 0;
    return {
      id: id(3, n), tenant_id: SHOWROOM_TENANT_ID, user_id: SHOWROOM_USER_ID, name, status, subject_line: subject, preheader: "Fresh from the greenhouse at Greenfield", preheader_text: "Fresh from the greenhouse at Greenfield",
      content: html, created_at: iso(daysAgo + 4), updated_at: iso(daysAgo), sent_at: status === "sent" ? iso(daysAgo) : null, scheduled_at: status === "scheduled" ? iso(-daysAgo) : null,
      segment_id: segment ? id(2, segment) : null, include_all_customers: !segment, additional_customer_ids: [], auto_send_enabled: false,
      total_recipients: sent || Math.round(optedIn * 0.9), projected_recipient_count: Math.round(optedIn * (segment ? 0.35 : 0.96)), total_sent: sent, messages_sent: sent, messages_failed: 0, messages_skipped: 0, stall_count: 0,
      open_rate: openRate, click_rate: clickRate, total_opens: openRate ? Math.round(sent * openRate / 100) : 0, total_clicks: clickRate ? Math.round(sent * clickRate / 100) : 0,
      sender_name: "Greenfield Garden Centre", sender_display_name: "Greenfield Garden Centre", sender_email: "hello@greenfield-demo.example", delivery_method: "email", origin: "showroom", metadata: { demo: true }, metrics: null,
    };
  };
  const body = (headline: string, text: string, cta: string) => `<h1>${headline}</h1><p>${text}</p><p><a href="https://example.com">${cta}</a></p>`;
  // A complete sample newsletter, built from the real Campaign Studio block types.
  // Email renderers need absolute https image URLs.
  const sampleImage = `${typeof window !== "undefined" ? window.location.origin : "https://demo.bloomsuite.app"}/crm/images/newsletter-fallback.jpg`;
  const prayerPlant = "https://images.pexels.com/photos/4590439/pexels-photo-4590439.jpeg?auto=compress&cs=tinysrgb&w=900";
  const patioBlocks = [
    { id: "patio-1", type: "full-width-image", order: 0, visible: true, imageUrl: sampleImage, imageAlt: "Spring containers on a sunny patio" },
    { id: "patio-2", type: "headline", order: 1, visible: true, headline: "Your patio, but greener", headingLevel: "h1", textAlign: "center" },
    { id: "patio-3", type: "plain-text", order: 2, visible: true, body: "<p>Patio season starts this weekend. Our growers have filled the greenhouse with fresh herbs, trailing flowers and easy-care foliage, plus everything you need to plant a container that thrives all summer.</p>" },
    { id: "patio-4", type: "image-text", order: 3, visible: true, imageUrl: prayerPlant, imageAlt: "Prayer plant in a terracotta pot", headline: "Staff pick: the prayer plant", body: "<p>Its leaves fold up at night like hands in prayer. Bright, filtered light and evenly moist soil keep it happy indoors or on a shaded patio.</p>", buttonText: "Read the care guide", buttonUrl: "https://example.com/care/prayer-plant" },
    { id: "patio-5", type: "event", order: 4, visible: true, headline: "Free container planting workshop", body: "<p>Bring your pot. We'll bring the soil, plants and advice.</p>", eventStartDate: dateOnly(-9), eventStartTime: "10:00", eventLocation: "Greenfield greenhouse", eventFeeType: "free", buttonText: "Save your seat", buttonUrl: "https://example.com/workshops" },
    { id: "patio-6", type: "call-to-action", order: 5, visible: true, headline: "Members get 15% off containers", body: "<p>Greenfield Rewards members save on every pot and planter this week.</p>", buttonText: "Shop patio essentials", buttonUrl: "https://example.com/patio", textAlign: "center" },
  ];
  const campaigns: Row[] = [
    campaign(1, "Mother's Day Hanging Baskets", "sent", "Hanging baskets she'll love (and so will the hummingbirds)", 21, 32.4, 6.1, null, body("Mother's Day baskets are in", "Over 400 hand-planted baskets, fuchsias to calibrachoa.", "See this week's baskets")),
    campaign(2, "Houseplant Happy Hour Workshop", "sent", "Repotting night: bring a plant, leave with a happier one", 45, 41.8, 9.3, 1, body("Houseplant Happy Hour", "Thursday 6:30 pm in the greenhouse. Soil and pots on us.", "Save your seat")),
    campaign(3, "Veggie Starts Are Here", "sent", "Tomatoes, peppers and 40 kinds of herbs just landed", 58, 36.2, 7.4, 2, body("The veggie starts are here", "Heirloom tomatoes, peppers and herbs grown right here.", "Plan your garden")),
    campaign(4, "Spring Perennial Sale", "scheduled", "20% off perennials this weekend only", -5, null, null, null, body("Spring Perennial Sale", "20% off every perennial, Saturday and Sunday.", "Shop the sale")),
    { ...campaign(5, "Patio Season Kickoff", "draft", "Your patio, but greener", 2, null, null, null, body("Patio season starts now", "Containers, soil and planting help for your best patio yet.", "Get container ideas")), metadata: { demo: true, contentBlocks: patioBlocks } },
  ];

  const field = (fid: string, type: string, label: string, mapping: string, required = false) => ({ id: fid, type, label, required, mapping_key: mapping, placeholder: "", step_index: 0 });
  const formSettings = (title: string, description: string, button: string) => ({ form_title: title, form_description: description, success_message: "Thanks! You're on the list.", submit_button_text: button, show_branding: true, theme: {}, notification_emails: [], steps: [{ index: 0, title, description }] });
  const compliance = { email_consent_required: true, email_consent_text: "Yes, email me plant news and offers from Greenfield. I can unsubscribe anytime.", sms_consent_required: false, sms_consent_text: "", double_opt_in: false, gdpr_compliant: true };
  const forms: Row[] = [
    { id: id(4, 1), tenant_id: SHOWROOM_TENANT_ID, name: "Newsletter sign-up", status: "published", embed_key: "demo0000000000000000000000000001", fields_json: [field("email", "email", "Email address", "email", true), field("first", "text", "First name", "first_name")], settings_json: formSettings("Get the Greenfield newsletter", "Seasonal planting tips and member offers.", "Sign me up"), compliance_json: compliance, audience_json: { assign_personas: [], assign_tags: ["newsletter"] }, created_at: iso(300), updated_at: iso(12) },
    { id: id(4, 2), tenant_id: SHOWROOM_TENANT_ID, name: "Greenfield Rewards enrolment", status: "published", embed_key: "demo0000000000000000000000000002", fields_json: [field("first", "text", "First name", "first_name", true), field("last", "text", "Last name", "last_name"), field("email", "email", "Email address", "email", true), field("phone", "phone", "Mobile number", "phone")], settings_json: formSettings("Join Greenfield Rewards", "Free to join. Earn points on every visit.", "Join for free"), compliance_json: compliance, audience_json: { assign_personas: [], assign_tags: ["loyalty"] }, created_at: iso(280), updated_at: iso(20) },
    { id: id(4, 3), tenant_id: SHOWROOM_TENANT_ID, name: "Workshop registration", status: "published", embed_key: "demo0000000000000000000000000003", fields_json: [field("name", "text", "Your name", "first_name", true), field("email", "email", "Email address", "email", true), field("workshop", "text", "Which workshop?", "custom", true)], settings_json: formSettings("Save your seat", "Spring workshops fill up fast.", "Register"), compliance_json: compliance, audience_json: { assign_personas: [], assign_tags: ["workshops"] }, created_at: iso(120), updated_at: iso(6) },
    { id: id(4, 4), tenant_id: SHOWROOM_TENANT_ID, name: "Customer feedback", status: "draft", embed_key: "demo0000000000000000000000000004", fields_json: [field("email", "email", "Email address", "email"), field("visit", "textarea", "How was your visit?", "custom", true)], settings_json: formSettings("Tell us how we did", "Two minutes. We read every answer.", "Send feedback"), compliance_json: { ...compliance, email_consent_required: false }, audience_json: { assign_personas: [], assign_tags: ["feedback"] }, created_at: iso(30), updated_at: iso(1) },
  ];

  const automation = (n: number, name: string, trigger: string, steps: { delay: number; channel: string; content: string }[], active: boolean): Row => ({
    id: id(5, n), tenant_id: SHOWROOM_TENANT_ID, user_id: SHOWROOM_USER_ID, name, trigger_type: trigger, is_active: active, overlap_behavior: "skip", version: 1, template_source: "showroom",
    workflow_steps: steps, flow_state: null, trigger_conditions: {}, persona_targeting: null, created_at: iso(200 - n * 10), updated_at: iso(n * 3),
  });
  const automations: Row[] = [
    automation(1, "Welcome to Greenfield", "customer_created", [{ delay: 0, channel: "email", content: "Welcome to Greenfield! Here's what's blooming this week." }, { delay: 3, channel: "email", content: "Meet our plant experts and book a free consult." }], true),
    automation(2, "New loyalty member", "loyalty_join", [{ delay: 0, channel: "email", content: "Welcome to Greenfield Rewards. Your first 100 points are on us." }], true),
    automation(3, "Post-purchase plant care", "first_purchase", [{ delay: 1, channel: "email", content: "Your new plant's care guide, plus tips for its first two weeks." }, { delay: 14, channel: "email", content: "How is your plant settling in?" }], true),
    automation(4, "Seasonal planting reminder", "date_based", [{ delay: 0, channel: "email", content: "It's time to plant garlic and spring bulbs." }], false),
    automation(5, "Customer re-engagement", "inactivity", [{ delay: 0, channel: "email", content: "We miss you! Here's 15% off your next visit." }, { delay: 7, channel: "sms", content: "Your 15% off ends Sunday." }], false),
  ];

  const tagsList = ["houseplants", "vegetables", "loyalty", "workshops", "natives", "containers", "newsletter", "gift"];
  const crmTags = tagsList.map((name, i) => ({ id: id(6, i + 1), tenant_id: SHOWROOM_TENANT_ID, name, created_at: iso(300) }));

  const activity: Row[] = customers.slice(0, 40).flatMap((c, i) => [
    { id: id(7, i * 2 + 1), tenant_id: SHOWROOM_TENANT_ID, customer_id: c.id, activity_type: "purchase", actor_type: "system", source: "bloomsuite_pos", status: "success", title: `In-store purchase · $${(30 + (i * 17) % 140).toFixed(2)}`, description: { text: "Greenfield Garden Centre register" }, links: [], metadata: { demo: true }, related_entities: {}, timestamp: iso(i % 20), created_at: iso(i % 20) },
    { id: id(7, i * 2 + 2), tenant_id: SHOWROOM_TENANT_ID, customer_id: c.id, activity_type: "email_opened", actor_type: "customer", source: "email", status: "success", title: "Opened \"Mother's Day Hanging Baskets\"", description: { text: "Email campaign" }, links: [], metadata: { demo: true }, related_entities: {}, timestamp: iso(21), created_at: iso(21) },
  ]);

  return {
    tenants: [{ id: SHOWROOM_TENANT_ID, name: SHOWROOM_BUSINESS, slug: "greenfield-demo", is_active: true, city: "Abbotsford", region: "BC", country: "CA", website: "https://example.com", settings: { is_demo: true, subscription_plan: "bloom", timezone: "America/Vancouver" }, email_under_review: false, email_under_review_details: null, created_at: iso(540), updated_at: iso(1), archived_at: null, default_from_email_domain_id: null }],
    users: [{ id: SHOWROOM_USER_ID, email: SHOWROOM_USER_EMAIL, name: "Demo Owner", full_name: "Demo Owner", role: "owner", tenant_id: SHOWROOM_TENANT_ID, created_at: iso(540), last_sign_in_at: iso(0) }],
    company_profiles: [{ id: id(8, 1), user_id: SHOWROOM_USER_ID, tenant_id: SHOWROOM_TENANT_ID, company_name: SHOWROOM_BUSINESS, onboarding_completed_at: iso(500), postal_code: "V2S 0A1", location_needs_confirmation: false, city: "Abbotsford", region: "BC", country: "CA", first_content_generated: true, created_at: iso(540), industry: "Garden centre", website_url: "https://example.com" }],
    // Display-only plan so trial banners stay away. No billing relationship exists.
    subscriptions: [{ id: id(9, 1), user_id: SHOWROOM_USER_ID, tenant_id: SHOWROOM_TENANT_ID, plan: "bloom", tier: "bloom", status: "active", start_date: iso(500), end_date: iso(-365), created_at: iso(500), updated_at: iso(1) }],
    email_domains: [{ id: id(10, 1), tenant_id: SHOWROOM_TENANT_ID, domain: "greenfield-demo.example", status: "verified", resend_status: "verified", verified_at: iso(400), default_from_email: "hello@greenfield-demo.example", default_from_name: "Greenfield Garden Centre", env: "production", is_sandbox: false, warmup_stage: "complete", dns_records: [], created_at: iso(420), updated_at: iso(10) }],
    crm_customers: customers,
    crm_segments: segments,
    customer_segments: memberships,
    crm_campaigns: campaigns,
    forms,
    crm_automations: automations,
    crm_tags: crmTags,
    customer_tags: [],
    crm_activity_events: activity,
  };
}
