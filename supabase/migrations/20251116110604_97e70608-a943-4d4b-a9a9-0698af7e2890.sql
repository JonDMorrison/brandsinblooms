-- Super Admin Help Desk Access Implementation
-- Creates secure role checking functions and updates RLS policies

-- 1. Create super admin check function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_admin_emails
    WHERE email = (SELECT email FROM auth.users WHERE id = user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Create support role enum
CREATE TYPE support_role AS ENUM ('support_agent', 'support_admin');

-- 3. Create user support roles table
CREATE TABLE user_support_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role support_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id, role)
);

-- Enable RLS on user_support_roles
ALTER TABLE user_support_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_support_roles
CREATE POLICY "Super admins can manage all support roles"
  ON user_support_roles FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own support roles"
  ON user_support_roles FOR SELECT
  USING (user_id = auth.uid());

-- 4. Create support role check function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION has_support_role(
  _user_id UUID,
  _tenant_id UUID,
  _role support_role
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_support_roles
    WHERE user_id = _user_id
    AND tenant_id = _tenant_id
    AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Update RLS policies for support_tickets

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all tickets in tenant" ON support_tickets;
DROP POLICY IF EXISTS "Admins can update tickets in tenant" ON support_tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON support_tickets;

-- New policies for super admins
CREATE POLICY "Super admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all tickets"
  ON support_tickets FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete all tickets"
  ON support_tickets FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Support agents can view and update tickets in their tenant
CREATE POLICY "Support agents can view tickets in their tenant"
  ON support_tickets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_support_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Support agents can update tickets in their tenant"
  ON support_tickets FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_support_roles
      WHERE user_id = auth.uid()
    )
  );

-- 6. Update RLS policies for support_comments

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all comments in tenant" ON support_comments;
DROP POLICY IF EXISTS "Admins can create comments" ON support_comments;
DROP POLICY IF EXISTS "Admins can update comments in tenant" ON support_comments;
DROP POLICY IF EXISTS "Admins can delete comments in tenant" ON support_comments;

-- New policies for super admins
CREATE POLICY "Super admins can manage all comments"
  ON support_comments FOR ALL
  USING (is_super_admin(auth.uid()));

-- Support agents can manage comments in their tenant
CREATE POLICY "Support agents can view comments in their tenant"
  ON support_comments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Support agents can create comments in their tenant"
  ON support_comments FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Support agents can update comments in their tenant"
  ON support_comments FOR UPDATE
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- 7. Update RLS policies for support_attachments

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all attachments in tenant" ON support_attachments;
DROP POLICY IF EXISTS "Admins can create attachments" ON support_attachments;
DROP POLICY IF EXISTS "Admins can delete attachments in tenant" ON support_attachments;

-- New policies for super admins
CREATE POLICY "Super admins can manage all attachments"
  ON support_attachments FOR ALL
  USING (is_super_admin(auth.uid()));

-- Support agents can manage attachments in their tenant
CREATE POLICY "Support agents can view attachments in their tenant"
  ON support_attachments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Support agents can create attachments in their tenant"
  ON support_attachments FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Support agents can delete attachments in their tenant"
  ON support_attachments FOR DELETE
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- 8. Update RLS policies for support_categories

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can manage categories" ON support_categories;

-- New policies
CREATE POLICY "Super admins can manage all categories"
  ON support_categories FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Support agents can manage categories in their tenant"
  ON support_categories FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_support_roles
      WHERE user_id = auth.uid()
    )
  );

-- 9. Update RLS policies for support_ticket_history

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can view ticket history in tenant" ON support_ticket_history;

-- New policies
CREATE POLICY "Super admins can view all ticket history"
  ON support_ticket_history FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Support agents can view ticket history in their tenant"
  ON support_ticket_history FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- 10. Update RLS policies for support_notifications

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can view notifications in tenant" ON support_notifications;

-- New policies
CREATE POLICY "Super admins can manage all notifications"
  ON support_notifications FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Support agents can view notifications in their tenant"
  ON support_notifications FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_support_roles
        WHERE user_id = auth.uid()
      )
    )
  );