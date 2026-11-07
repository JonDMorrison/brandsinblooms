// Bloom Support — loads a client company's brand (website, logo) from our own
// stored records: the account's single linked BloomSites site (signed CMS
// `site.read`) and the CRM company profile of its linked tenant. Shared by the
// support emails (bloom-support-worker) and the public tracking page so both
// show the same thing. brandFromSources / clientWebsite / clientLogoUrl decide
// what is acceptable; this module only gathers the facts.
//
// Best effort: callers never fail because of it, and results are cached per
// account for ten minutes per function instance.
import { type Caller, db, rpc } from "./runtime.ts";
import { callProduct } from "./operations.ts";
import type { ClientBrand } from "./botanical-email.ts";
import { brandFromSources, type CmsSiteFacts, type CrmBrandFacts } from "./client-brand.ts";

const BRAND_TTL_MS = 10 * 60_000;
const brandCache = new Map<string, { at: number; brand: Promise<ClientBrand | null> }>();

export function clientBrand(actor: Caller, account: { id: string; name: string } | null | undefined): Promise<ClientBrand | null> {
  if (!account?.id || !account.name?.trim()) return Promise.resolve(null);
  const hit = brandCache.get(account.id);
  if (hit && Date.now() - hit.at < BRAND_TTL_MS) return hit.brand;
  const brand = loadClientBrand(actor, account).catch((e) => {
    console.error("client brand", account.id, e instanceof Error ? e.message : String(e));
    return null;
  });
  brandCache.set(account.id, { at: Date.now(), brand });
  return brand;
}

async function loadClientBrand(actor: Caller, account: { id: string; name: string }): Promise<ClientBrand> {
  const a = await rpc<{ crm_tenant_id: string | null; links: Array<{ product: string; external_id: string }> }>("get_account", { actor: actor.principalId, account_id: account.id });
  const sites = (a.links ?? []).filter((l) => l.product === "cms");
  const [site, crm] = await Promise.all([
    sites.length === 1
      ? callProduct("cms", "site.read", {
        site_id: sites[0].external_id, inputs: {},
        actor: { principal_id: actor.principalId, role: actor.role, name: actor.name ?? null, via: actor.via },
      }, 8000).then((r) => (r.site ?? null) as CmsSiteFacts | null).catch(() => null)
      : Promise.resolve(null),
    a.crm_tenant_id ? crmBrandFacts(a.crm_tenant_id).catch(() => null) : Promise.resolve(null),
  ]);
  return brandFromSources(account.name.trim(), site, crm);
}

/** The CRM tenant's website and logo: tenants.website and its owner's (else admin's) company profile. */
async function crmBrandFacts(tenantId: string): Promise<CrmBrandFacts | null> {
  const [{ data: tenant }, { data: users }] = await Promise.all([
    db().from("tenants").select("website").eq("id", tenantId).maybeSingle(),
    db().from("users").select("id, role").eq("tenant_id", tenantId).in("role", ["owner", "admin"]).limit(25),
  ]);
  const rows = (users ?? []) as Array<{ id: string; role: string | null }>;
  const owner = rows.find((r) => r.role === "owner") ?? rows[0];
  const { data: profile } = owner
    ? await db().from("company_profiles").select("website_url, feature_flags").eq("user_id", owner.id).maybeSingle()
    : { data: null };
  const p = profile as { website_url?: string | null; feature_flags?: { company_logo_url?: unknown } | null } | null;
  return {
    tenant_website: (tenant as { website?: string | null } | null)?.website ?? null,
    website_url: p?.website_url ?? null,
    logo_url: typeof p?.feature_flags?.company_logo_url === "string" ? p.feature_flags.company_logo_url : null,
  };
}
