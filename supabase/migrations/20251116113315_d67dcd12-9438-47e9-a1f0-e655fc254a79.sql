-- Add unique constraint to user_support_roles table
ALTER TABLE user_support_roles 
ADD CONSTRAINT user_support_roles_user_tenant_unique 
UNIQUE (user_id, tenant_id);

-- Add support admin role for the current user
INSERT INTO user_support_roles (user_id, tenant_id, role)
VALUES (
  'de31806f-8134-4f15-b844-cf3f015e886a',
  '89ff9f89-ba73-4843-9e4a-733440314168',
  'support_admin'
);