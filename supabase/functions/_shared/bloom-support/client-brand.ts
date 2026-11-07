/**
 * Which website and logo Bloom Support emails show for a client company.
 *
 * Every value comes from our own stored records, never from a ticket or a
 * message:
 *   - BloomSites `public.sites` (via the signed CMS `site.read` operation for
 *     the account's single linked site): `custom_domain` once
 *     `custom_domain_status` is "verified", otherwise the live
 *     `{subdomain}.bloomsites.app` address, and `logo_url`.
 *   - The CRM company profile of the account's linked tenant
 *     (`company_profiles.website_url`, `feature_flags.company_logo_url`) and
 *     `tenants.website`.
 * The website shown is the site Bloom itself hosts when there is one, then the
 * CRM profile. Both are re-validated by clientWebsite / clientLogoUrl when the
 * email is rendered.
 *
 * Pure: no I/O and no Deno globals.
 */
import { type ClientBrand, clientLogoUrl, clientWebsite } from "./botanical-email.ts";

/** BloomSites serves every published site at {subdomain}.bloomsites.app. */
export const BLOOMSITES_HOST = "bloomsites.app";

export interface CmsSiteFacts {
  subdomain?: string | null;
  custom_domain?: string | null;
  /** Present once the CMS returns it; when present, only "verified" custom domains are used. */
  custom_domain_status?: string | null;
  is_active?: boolean | null;
  is_published?: boolean | null;
  logo_url?: string | null;
}

export interface CrmBrandFacts {
  website_url?: string | null;
  tenant_website?: string | null;
  logo_url?: string | null;
}

/** The address a published BloomSites site is served at, or null when it isn't live. */
export function cmsSiteWebsite(site: CmsSiteFacts | null | undefined): string | null {
  if (!site || site.is_active === false || site.is_published !== true) return null;
  const custom = typeof site.custom_domain === "string" ? site.custom_domain.trim() : "";
  const customOk = custom && (site.custom_domain_status === undefined || site.custom_domain_status === "verified");
  if (customOk && clientWebsite(custom)) return custom;
  const sub = typeof site.subdomain === "string" ? site.subdomain.trim().toLowerCase() : "";
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) return `${sub}.${BLOOMSITES_HOST}`;
  return null;
}

export function brandFromSources(name: string, site: CmsSiteFacts | null, crm: CrmBrandFacts | null): ClientBrand {
  const website = [cmsSiteWebsite(site), crm?.website_url, crm?.tenant_website].find((w) => clientWebsite(w)) ?? null;
  const logoUrl = [site?.logo_url, crm?.logo_url].find((l) => clientLogoUrl(l)) ?? null;
  return { name, website, logoUrl };
}
