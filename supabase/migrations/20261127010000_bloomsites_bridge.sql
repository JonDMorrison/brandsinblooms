-- Read-only BloomSites bridge for newsletter assets.
--
-- Tenant -> BloomSites site links reuse public.newsletter_storefront_connections
-- (20261019184018_website_newsletter_bridge.sql), the table the website
-- newsletter bridge already reads. No second link table is created.
--
-- 1. public.bloomsites_site_link_candidates: review table of proposed
--    tenant <-> site matches (custom domain first, then business name).
-- 2. public.record_bloomsites_link_candidates(p_sites jsonb): records the
--    matches for a list of BloomSites sites. A match is linked into
--    newsletter_storefront_connections only when the site's custom domain
--    equals the host of the tenant's business-profile website exactly, that
--    host belongs to exactly one tenant, and neither side is already linked
--    elsewhere. Every other match stays pending review.
-- 3. public.bloomsites_public_config(): the BloomSites API URL and its
--    publishable (anon) key, read from Vault. The bridge only issues GET
--    requests with this key and never writes to BloomSites.
-- All three are service_role only.

CREATE TABLE public.bloomsites_site_link_candidates (
  site_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('custom_domain', 'business_name')),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'auto_linked', 'already_linked', 'approved', 'rejected')),
  site_name text,
  site_custom_domain text,
  tenant_name text,
  tenant_website_host text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  PRIMARY KEY (site_id, tenant_id)
);

ALTER TABLE public.bloomsites_site_link_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bloomsites_site_link_candidates FROM anon, authenticated;
GRANT ALL ON public.bloomsites_site_link_candidates TO service_role;

CREATE OR REPLACE FUNCTION public.record_bloomsites_link_candidates(p_sites jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  site jsonb;
  v_site_id uuid;
  v_domain text;
  v_site_name text;
  v_site_key text;
  candidate record;
  domain_matches integer;
  v_status text;
  v_note text;
  linked integer := 0;
  recorded integer := 0;
BEGIN
  IF jsonb_typeof(p_sites) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_sites must be a JSON array';
  END IF;

  FOR site IN SELECT value FROM jsonb_array_elements(p_sites) LOOP
    v_site_id := (site->>'id')::uuid;
    v_domain := nullif(lower(btrim(coalesce(site->>'custom_domain', ''))), '');
    v_site_name := coalesce(nullif(btrim(site->>'business_name'), ''), nullif(btrim(site->>'name'), ''));
    v_site_key := regexp_replace(replace(lower(coalesce(v_site_name, '')), '&', 'and'), '[^a-z0-9]+', '', 'g');
    CONTINUE WHEN v_site_id IS NULL;

    -- Business profiles (one per tenant owner; teammates resolve to it).
    FOR candidate IN
      WITH profiles AS (
        SELECT u.tenant_id, cp.user_id AS owner_id, t.name AS tenant_name,
               cp.company_name,
               lower(substring(cp.website_url from '^https?://([^/:?#]+)')) AS host
          FROM public.company_profiles cp
          JOIN public.users u ON u.id = cp.user_id
          JOIN public.tenants t ON t.id = u.tenant_id
         WHERE cp.deleted_at IS NULL
           AND u.tenant_id IS NOT NULL
           AND cp.user_id = public.profile_user_id_for(cp.user_id)
      )
      SELECT p.*,
             CASE WHEN v_domain IS NOT NULL AND p.host = v_domain THEN 'custom_domain'
                  ELSE 'business_name' END AS match_type
        FROM profiles p
       WHERE (v_domain IS NOT NULL AND p.host = v_domain)
          OR (length(v_site_key) >= 4 AND v_site_key IN (
                regexp_replace(replace(lower(coalesce(p.company_name, '')), '&', 'and'), '[^a-z0-9]+', '', 'g'),
                regexp_replace(replace(lower(coalesce(p.tenant_name, '')), '&', 'and'), '[^a-z0-9]+', '', 'g')))
    LOOP
      v_status := 'pending_review';
      v_note := NULL;

      IF EXISTS (SELECT 1 FROM public.newsletter_storefront_connections c
                  WHERE c.site_id = v_site_id AND c.tenant_id = candidate.tenant_id) THEN
        v_status := 'already_linked';
      ELSIF candidate.match_type = 'custom_domain' THEN
        SELECT count(DISTINCT u.tenant_id) INTO domain_matches
          FROM public.company_profiles cp
          JOIN public.users u ON u.id = cp.user_id
         WHERE cp.deleted_at IS NULL AND u.tenant_id IS NOT NULL
           AND lower(substring(cp.website_url from '^https?://([^/:?#]+)')) = v_domain;
        IF domain_matches <> 1 THEN
          v_note := 'Domain belongs to more than one tenant';
        ELSIF EXISTS (SELECT 1 FROM public.newsletter_storefront_connections c WHERE c.site_id = v_site_id) THEN
          v_note := 'Site is already linked to another tenant';
        ELSIF EXISTS (SELECT 1 FROM public.newsletter_storefront_connections c WHERE c.tenant_id = candidate.tenant_id) THEN
          v_note := 'Tenant is already linked to another site';
        ELSE
          INSERT INTO public.newsletter_storefront_connections (site_id, tenant_id, owner_id, origin)
          VALUES (v_site_id, candidate.tenant_id, candidate.owner_id, 'https://' || v_domain)
          ON CONFLICT (site_id) DO NOTHING;
          IF FOUND THEN
            v_status := 'auto_linked';
            linked := linked + 1;
          END IF;
        END IF;
      ELSE
        v_note := 'Business name match only; review before linking';
      END IF;

      INSERT INTO public.bloomsites_site_link_candidates AS c (
        site_id, tenant_id, owner_id, match_type, status, site_name,
        site_custom_domain, tenant_name, tenant_website_host, note
      ) VALUES (
        v_site_id, candidate.tenant_id, candidate.owner_id, candidate.match_type, v_status,
        v_site_name, v_domain, candidate.tenant_name, candidate.host, v_note
      )
      ON CONFLICT (site_id, tenant_id) DO UPDATE SET
        match_type = EXCLUDED.match_type,
        -- A reviewer's decision is kept; machine statuses are refreshed.
        status = CASE WHEN c.status IN ('approved', 'rejected') THEN c.status ELSE EXCLUDED.status END,
        site_name = EXCLUDED.site_name,
        site_custom_domain = EXCLUDED.site_custom_domain,
        tenant_name = EXCLUDED.tenant_name,
        tenant_website_host = EXCLUDED.tenant_website_host,
        note = EXCLUDED.note,
        updated_at = now();
      recorded := recorded + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('recorded', recorded, 'auto_linked', linked);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_bloomsites_link_candidates(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_bloomsites_link_candidates(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.bloomsites_public_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'url', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bloomsites_supabase_url'),
    'anon_key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bloomsites_anon_key')
  );
$function$;

REVOKE ALL ON FUNCTION public.bloomsites_public_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloomsites_public_config() TO service_role;
