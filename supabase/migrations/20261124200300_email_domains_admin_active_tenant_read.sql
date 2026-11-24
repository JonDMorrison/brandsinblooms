-- NOT YET APPLIED to udldmkqwnxhdeztyqcau: apply_migration timed out waiting
-- for a confirmation on 2026-11-24. Apply, then rename to the recorded version.

-- QA pass 4 follow-up #2: a master admin working in a company (the admin
-- tenant switcher, public.admin_active_tenant_id) can read that company's
-- email_domains, as products and crm_customers already allow. email_domains
-- was readable only through public.users.tenant_id, so a draft an admin
-- created while viewing Northfield started with no sender: the draft sender
-- loader (src/lib/crm/draftSenderDefaults.ts) reads email_domains for the
-- active tenant and got no rows.
--
-- Additive SELECT policy only; no write policies. admin_active_tenant_id()
-- returns NULL for anyone who is not a master admin, so other users are
-- unaffected.

drop policy if exists "Master admins can view the active company's email domains" on public.email_domains;
create policy "Master admins can view the active company's email domains"
  on public.email_domains
  for select
  to authenticated
  using (tenant_id = public.admin_active_tenant_id());
