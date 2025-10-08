# Master Admin System Documentation

## Overview

The Master Admin System allows super administrators to manage client accounts without logging in as them. This provides secure account management, support capabilities, and audit logging.

## Architecture

### Database Components

1. **Roles Table** (`user_roles`):
   - Stores user role assignments
   - Supports: `master_admin`, `admin`, `user`
   - Unique constraint per user/role combination

2. **Audit Log** (`admin_audit_log`):
   - Tracks all admin actions
   - Records: admin ID, target tenant, action type, details
   - Compliance and security monitoring

3. **Session Context** (`admin_session_context`):
   - Tracks which tenant an admin is currently managing
   - Persists across page reloads

### Security Functions

- `has_role(user_id, role)`: Check if user has a specific role
- `is_master_admin(user_id)`: Check if user is a master admin
- `log_admin_action()`: Log admin actions for audit trail

## How to Use

### 1. Assign Master Admin Role

Run this SQL to make a user a master admin:

```sql
-- Replace with actual user UUID
INSERT INTO public.user_roles (user_id, role, created_by_user_id)
VALUES ('user-uuid-here', 'master_admin', 'user-uuid-here');
```

### 2. Access Admin Interface

Once assigned the master_admin role, users will see:
- **TenantSwitcher**: Select which tenant to manage
- Access to all tenant data in the selected context
- Admin-only UI components

### 3. Implement Admin Actions

Use the `useAdminTenantActions` hook in your components:

```typescript
import { useAdminTenantActions } from '@/hooks/useAdminTenantActions';

function MyComponent() {
  const { importCustomers, createCampaign, uploadMedia } = useAdminTenantActions();

  const handleImport = async () => {
    const customers = [...]; // Your customer data
    await importCustomers(customers);
  };
}
```

## Available Admin Actions

### Import Customers

```typescript
await importCustomers([
  {
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+15551234567',
    sms_opt_in: true,
    custom_fields: { notes: 'VIP customer' }
  }
]);
```

### Create Campaign

```typescript
await createCampaign({
  name: 'Holiday Sale',
  message: 'Save 20% this weekend!',
  status: 'draft'
});
```

### Upload Media

```typescript
await uploadMedia(file, 'media-mms');
```

### Update Tenant Configuration

```typescript
await updateTenantConfig({
  company_name: 'Updated Name',
  // other config fields
});
```

## Edge Function API

### Endpoint

```
POST https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/admin-manage-tenant
```

### Authentication

Include the admin's auth token in the Authorization header:

```
Authorization: Bearer <admin-token>
```

### Request Format

```json
{
  "action": "import_customers",
  "tenantId": "tenant-uuid",
  "data": {
    "customers": [...]
  }
}
```

### Supported Actions

- `import_customers`: Bulk import customer records
- `create_campaign`: Create email/SMS campaigns
- `upload_media`: Upload media files to storage
- `update_tenant_config`: Update tenant settings

## CSV Import Format

Example CSV for customer import:

```csv
email,first_name,last_name,phone,sms_opt_in
john@example.com,John,Doe,+15551234567,true
jane@example.com,Jane,Smith,+15557654321,false
```

Required fields:
- `email` (required)
- `first_name` (optional)
- `last_name` (optional)
- `phone` (optional)
- `sms_opt_in` (optional, boolean)

Additional columns will be stored in `custom_fields`.

## Security Considerations

1. **Role-Based Access**: Only users with `master_admin` role can perform admin actions
2. **Audit Logging**: All actions are logged with admin ID, tenant, and action details
3. **Service Role**: Edge function uses service role for elevated permissions
4. **No User Impersonation**: Admins perform actions on behalf of tenants, not as them

## Monitoring & Compliance

### View Audit Logs

```sql
SELECT 
  al.*,
  au.email as admin_email,
  t.company_name as tenant_name
FROM admin_audit_log al
JOIN auth.users au ON au.id = al.admin_user_id
LEFT JOIN tenants t ON t.id = al.target_tenant_id
ORDER BY al.created_at DESC
LIMIT 100;
```

### Check Admin Roles

```sql
SELECT 
  ur.role,
  au.email,
  ur.created_at
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.role = 'master_admin';
```

## UI Components

### TenantSwitcher

Located in `src/components/admin/TenantSwitcher.tsx`

Shows available tenants and allows switching between them.

### AdminCSVImport

Located in `src/components/admin/AdminCSVImport.tsx`

Provides CSV upload and import functionality for customer data.

### AdminContext

Located in `src/contexts/AdminContext.tsx`

Manages admin state including active tenant selection.

## Best Practices

1. **Always Log Actions**: Use `log_admin_action()` for audit trail
2. **Validate Input**: Check data before importing/updating
3. **Test in Staging**: Test admin actions in staging environment first
4. **Monitor Logs**: Regularly review audit logs for security
5. **Limit Access**: Only assign master_admin role to trusted personnel
6. **Use Context**: Always check `activeTenantId` before performing actions

## Troubleshooting

### "Access denied. Master admin required"

- Verify user has `master_admin` role in `user_roles` table
- Check auth token is valid and being sent correctly

### "No tenant selected"

- Use TenantSwitcher to select a tenant before performing actions
- Check `activeTenantId` is set in AdminContext

### Import Fails

- Verify CSV format matches expected headers
- Check data types (especially boolean for sms_opt_in)
- Review edge function logs for specific error messages
