-- Applied to udldmkqwnxhdeztyqcau on 2026-11-24 (recorded version in filename).

-- QA pass 4 #7: a master admin working in a company (the admin tenant
-- switcher, public.admin_active_tenant_id) can read that company's products,
-- as crm_customers already allows. Products were readable only through
-- public.users.tenant_id, so global search (and /products) showed nothing
-- for "hydrangea" while an admin viewed Northfield.
--
-- Additive SELECT policy only. admin_active_tenant_id() returns NULL for
-- anyone who is not a master admin, so other users are unaffected.

drop policy if exists "Master admins can view the active company's products" on public.products;
create policy "Master admins can view the active company's products"
  on public.products
  for select
  to authenticated
  using (tenant_id = public.admin_active_tenant_id());
