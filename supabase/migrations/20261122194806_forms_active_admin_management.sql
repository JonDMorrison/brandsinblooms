-- Master administrators may manage forms only in their explicitly selected account.
-- Existing tenant-user policies remain unchanged.
create policy forms_active_admin_manage on public.forms for all to authenticated
using (public.is_master_admin(auth.uid()) and public.has_tenant_permission(tenant_id,'campaign.write',null))
with check (public.is_master_admin(auth.uid()) and public.has_tenant_permission(tenant_id,'campaign.write',null));
