// Seeds the fixed eval world into a NON-production Supabase project with the
// service-role key, and creates (or re-keys) the eval users.
//
// Table shapes and constraints: crm_customers, customer_purchase_metrics,
// crm_campaigns and products (see supabase/migrations). Signing up an auth user
// fires handle_new_user_signup, which creates a tenant named after
// user_metadata.company_name and a public.users row with role "admin".

import { randomBytes } from "node:crypto";
import {
  EMAIL_DOMAIN,
  EVAL_USERS,
  HOME_CAMPAIGN,
  HOME_COMPANY,
  HOME_CUSTOMERS,
  HOME_PRODUCTS,
  RIVAL_CAMPAIGN,
  RIVAL_COMPANY,
  RIVAL_CUSTOMERS,
  RIVAL_PRODUCTS,
  SEED_MARKER,
  customerEmail,
  daysAgo,
} from "./fixtures.mjs";

const PRODUCTION_PROJECT_REF = "udldmkqwnxhdeztyqcau";

/**
 * Refuses production. The eval writes synthetic customers and sends prompt
 * injection attempts, which must never touch real tenants.
 * @param {string} url
 */
export function assertNonProductionTarget(url) {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(`BLOOM_EVAL_SUPABASE_URL is not a valid URL: ${url}`);
  }
  if (host.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("Refusing to run Bloom evals against the production Supabase project.");
  }
  return host;
}

/** @param {{ error: { message: string } | null, data?: unknown }} result @param {string} label */
function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export const generatePassword = () => `${randomBytes(18).toString("base64url")}Aa1!`;

/**
 * @param {string} tenantId
 * @param {typeof HOME_CUSTOMERS} customers
 * @param {Date} now
 */
export function buildCustomerRows(tenantId, customers, now) {
  return customers.map((customer) => ({
    tenant_id: tenantId,
    email: customerEmail(customer),
    first_name: customer.first,
    last_name: customer.last,
    phone: "phone" in customer ? customer.phone : null,
    total_spent: customer.spent,
    pos_order_count: customer.orders,
    first_purchase_date: daysAgo(customer.firstDaysAgo, now),
    last_purchase_date: daysAgo(customer.lastDaysAgo, now),
    custom_fields: {
      seed: SEED_MARKER,
      ...("notes" in customer && customer.notes ? { notes: customer.notes } : {}),
    },
  }));
}

/**
 * @param {string} tenantId
 * @param {typeof HOME_CUSTOMERS} customers
 * @param {Map<string, string>} idsByEmail
 * @param {Date} now
 */
export function buildMetricRows(tenantId, customers, idsByEmail, now) {
  return customers.map((customer) => {
    const customerId = idsByEmail.get(customerEmail(customer));
    if (!customerId) throw new Error(`Seeded customer missing: ${customerEmail(customer)}`);
    return {
      tenant_id: tenantId,
      customer_id: customerId,
      lifetime_value: customer.spent,
      total_purchases: customer.orders,
      purchase_frequency: customer.orders,
      average_order_value: Math.round((customer.spent / customer.orders) * 100) / 100,
      days_since_last_purchase: customer.lastDaysAgo,
      purchase_velocity: customer.velocity,
      first_purchase_date: daysAgo(customer.firstDaysAgo, now),
      last_purchase_date: daysAgo(customer.lastDaysAgo, now),
    };
  });
}

/**
 * Sent more than 48 hours ago so get_campaign_analytics reads the stored
 * metrics instead of recomputing them (campaign-analytics.ts).
 * @param {string} tenantId
 * @param {typeof HOME_CAMPAIGN} campaign
 * @param {Date} now
 */
export function buildCampaignRow(tenantId, campaign, now) {
  const sentAt = new Date(now.getTime() - campaign.sentDaysAgo * 86_400_000).toISOString();
  const completedAt = new Date(new Date(sentAt).getTime() + 38 * 60_000).toISOString();
  return {
    tenant_id: tenantId,
    name: campaign.name,
    subject_line: campaign.subject,
    content: `${campaign.name}. Seeded by ${SEED_MARKER}.`,
    status: "sent",
    delivery_method: "shared_sender",
    auto_send_enabled: false,
    sent_at: sentAt,
    send_started_at: sentAt,
    send_completed_at: completedAt,
    total_recipients: campaign.recipients,
    total_sent: campaign.recipients,
    messages_sent: campaign.recipients,
    messages_failed: 0,
    messages_skipped: 0,
    total_opens: campaign.opens,
    total_clicks: campaign.clicks,
    open_rate: campaign.openRate,
    click_rate: campaign.clickRate,
    metrics: {
      sent: campaign.recipients,
      delivered: campaign.recipients,
      opened: campaign.opens,
      clicked: campaign.clicks,
      bounced: 0,
      unsubscribed: 0,
    },
  };
}

/** @param {string} tenantId @param {typeof HOME_PRODUCTS} products */
export function buildProductRows(tenantId, products) {
  return products.map((product) => ({
    tenant_id: tenantId,
    name: product.name,
    sku: product.sku,
    price: product.price,
    inventory_count: product.stock,
    track_inventory: true,
    low_stock_threshold: 5,
    status: "active",
    source: "platform",
  }));
}

/**
 * Creates the auth user, or resets the password of an existing one.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ email: string, name: string }} spec
 * @param {string} company
 * @param {string} password
 */
async function ensureAuthUser(admin, spec, company, password) {
  const existing = must(
    await admin.from("users").select("id").eq("email", spec.email).maybeSingle(),
    `Look up ${spec.email}`,
  );
  if (existing?.id) {
    must(
      await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true }),
      `Reset password for ${spec.email}`,
    );
    return existing.id;
  }

  const created = must(
    await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { company_name: company, full_name: spec.name },
    }),
    `Create ${spec.email}`,
  );
  return created.user.id;
}

/**
 * Deletes everything in an eval tenant, after checking it really is one.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} tenantId
 * @param {string} expectedName
 */
async function resetTenant(admin, tenantId, expectedName) {
  const tenant = must(
    await admin.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    "Read eval tenant",
  );
  if (tenant?.name !== expectedName) {
    throw new Error(
      `Refusing to reset tenant ${tenantId}: its name is "${tenant?.name}", not the eval tenant "${expectedName}".`,
    );
  }
  const members = must(
    await admin.from("users").select("email").eq("tenant_id", tenantId),
    "Read eval tenant members",
  );
  const outsider = (members ?? []).find((member) => !String(member.email).endsWith(`@${EMAIL_DOMAIN}`));
  if (outsider) {
    throw new Error(`Refusing to reset tenant ${tenantId}: it has a non-eval member (${outsider.email}).`);
  }

  must(await admin.from("customer_purchase_metrics").delete().eq("tenant_id", tenantId), "Clear metrics");
  must(await admin.from("crm_customers").delete().eq("tenant_id", tenantId), "Clear customers");
  must(await admin.from("crm_campaigns").delete().eq("tenant_id", tenantId), "Clear campaigns");
  must(await admin.from("products").delete().eq("tenant_id", tenantId), "Clear products");
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} tenantId
 * @param {{ customers: typeof HOME_CUSTOMERS, campaign: typeof HOME_CAMPAIGN, products: typeof HOME_PRODUCTS }} world
 * @param {Date} now
 */
async function seedTenant(admin, tenantId, world, now) {
  const inserted = must(
    await admin.from("crm_customers").insert(buildCustomerRows(tenantId, world.customers, now)).select("id, email"),
    "Insert customers",
  );
  const idsByEmail = new Map((inserted ?? []).map((row) => [row.email, row.id]));
  must(
    await admin.from("customer_purchase_metrics").insert(buildMetricRows(tenantId, world.customers, idsByEmail, now)),
    "Insert purchase metrics",
  );
  must(await admin.from("crm_campaigns").insert(buildCampaignRow(tenantId, world.campaign, now)), "Insert campaign");
  must(await admin.from("products").insert(buildProductRows(tenantId, world.products)), "Insert products");
  return idsByEmail;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin service-role client
 * @param {{ now?: Date }} [options]
 */
export async function seedEvalWorld(admin, { now = new Date() } = {}) {
  /** @type {Record<string, { id: string, email: string, password: string, tenantId: string }>} */
  const users = {};

  const homeAdminPassword = generatePassword();
  const homeAdminId = await ensureAuthUser(admin, EVAL_USERS.admin, HOME_COMPANY, homeAdminPassword);
  const rivalPassword = generatePassword();
  const rivalId = await ensureAuthUser(admin, EVAL_USERS.rival, RIVAL_COMPANY, rivalPassword);

  const homeRow = must(await admin.from("users").select("tenant_id").eq("id", homeAdminId).single(), "Read home tenant");
  const rivalRow = must(await admin.from("users").select("tenant_id").eq("id", rivalId).single(), "Read rival tenant");
  const homeTenantId = homeRow.tenant_id;
  const rivalTenantId = rivalRow.tenant_id;
  if (!homeTenantId || !rivalTenantId || homeTenantId === rivalTenantId) {
    throw new Error("The eval admin and rival users must belong to two different tenants.");
  }

  must(await admin.from("tenants").update({ name: HOME_COMPANY }).eq("id", homeTenantId), "Name home tenant");
  must(await admin.from("tenants").update({ name: RIVAL_COMPANY }).eq("id", rivalTenantId), "Name rival tenant");

  users.admin = { id: homeAdminId, email: EVAL_USERS.admin.email, password: homeAdminPassword, tenantId: homeTenantId };
  users.rival = { id: rivalId, email: EVAL_USERS.rival.email, password: rivalPassword, tenantId: rivalTenantId };

  for (const key of /** @type {const} */ (["staff", "viewer"])) {
    const spec = EVAL_USERS[key];
    const password = generatePassword();
    const id = await ensureAuthUser(admin, spec, HOME_COMPANY, password);
    users[key] = { id, email: spec.email, password, tenantId: homeTenantId };
  }

  // Service role may change roles; the role-change guard lets it through.
  for (const key of Object.keys(users)) {
    const spec = EVAL_USERS[/** @type {keyof typeof EVAL_USERS} */ (key)];
    must(
      await admin
        .from("users")
        .update({ tenant_id: users[key].tenantId, role: spec.role, name: spec.name })
        .eq("id", users[key].id),
      `Set role for ${spec.email}`,
    );
    // A stable onboarding stage keeps the system prompt identical between runs.
    must(await admin.from("bloom_user_profiles").delete().eq("user_id", users[key].id), "Clear Bloom profile");
    must(
      await admin
        .from("bloom_user_profiles")
        .insert({ tenant_id: users[key].tenantId, user_id: users[key].id, onboarding_stage: 3 }),
      "Insert Bloom profile",
    );
  }

  await resetTenant(admin, homeTenantId, HOME_COMPANY);
  await resetTenant(admin, rivalTenantId, RIVAL_COMPANY);

  const homeCustomerIds = await seedTenant(
    admin,
    homeTenantId,
    { customers: HOME_CUSTOMERS, campaign: HOME_CAMPAIGN, products: HOME_PRODUCTS },
    now,
  );
  const rivalCustomerIds = await seedTenant(
    admin,
    rivalTenantId,
    { customers: RIVAL_CUSTOMERS, campaign: RIVAL_CAMPAIGN, products: RIVAL_PRODUCTS },
    now,
  );

  return { users, homeTenantId, rivalTenantId, homeCustomerIds, rivalCustomerIds };
}

/**
 * Reads the eval tenant's Bloom spending status so a run can stop early with a
 * clear message instead of failing every case on the spend-cap reply.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} tenantId
 */
export async function readSpendStatus(admin, tenantId) {
  const result = await admin.rpc("bloom_chat_spend_status", { p_tenant_id: tenantId });
  return result.error ? null : result.data;
}
