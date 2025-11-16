-- Help Desk & Support Module Schema

-- Create custom types
CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Support Categories Table
CREATE TABLE support_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_support_categories_tenant ON support_categories(tenant_id);

-- Support Tickets Table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ticket_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status DEFAULT 'open',
  priority ticket_priority DEFAULT 'medium',
  category_id UUID REFERENCES support_categories(id) ON DELETE SET NULL,
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  first_response_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, ticket_number)
);

CREATE INDEX idx_support_tickets_tenant_status ON support_tickets(tenant_id, status);
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_number ON support_tickets(ticket_number);

-- Support Comments Table
CREATE TABLE support_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_comments_ticket ON support_comments(ticket_id, created_at);
CREATE INDEX idx_support_comments_user ON support_comments(user_id);

-- Support Attachments Table
CREATE TABLE support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES support_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'support-attachments',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_attachments_ticket ON support_attachments(ticket_id);
CREATE INDEX idx_support_attachments_comment ON support_attachments(comment_id);

-- Support Ticket History Table
CREATE TABLE support_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_ticket_history_ticket ON support_ticket_history(ticket_id, created_at DESC);

-- Support Notifications Table
CREATE TABLE support_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_notifications_user ON support_notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_support_notifications_ticket ON support_notifications(ticket_id);

-- Function: Generate Ticket Number
CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  ticket_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'TKT-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM support_tickets
  WHERE tenant_id = p_tenant_id;
  
  ticket_number := 'TKT-' || LPAD(next_number::text, 6, '0');
  RETURN ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_updated_at();

CREATE TRIGGER trigger_support_categories_updated_at
  BEFORE UPDATE ON support_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_support_updated_at();

CREATE TRIGGER trigger_support_comments_updated_at
  BEFORE UPDATE ON support_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_support_updated_at();

-- Function: Log ticket changes
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'assigned',
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to),
      CASE 
        WHEN NEW.assigned_to IS NULL THEN 'Ticket unassigned'
        ELSE 'Ticket assigned to agent'
      END
    );
  END IF;
  
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO support_ticket_history (ticket_id, user_id, action, old_value, new_value, description)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'priority_changed',
      jsonb_build_object('priority', OLD.priority),
      jsonb_build_object('priority', NEW.priority),
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for logging ticket changes
CREATE TRIGGER trigger_log_ticket_changes
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_changes();

-- RLS Policies

-- Support Categories
ALTER TABLE support_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their tenant"
  ON support_categories FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage categories"
  ON support_categories FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Support Tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id = auth.uid() AND
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can view all tickets in tenant"
  ON support_tickets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'support_agent')
    )
  );

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their own open tickets"
  ON support_tickets FOR UPDATE
  USING (
    user_id = auth.uid() AND
    status = 'open' AND
    assigned_to IS NULL
  );

CREATE POLICY "Admins can update tickets in tenant"
  ON support_tickets FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'support_agent')
    )
  );

CREATE POLICY "Admins can delete tickets"
  ON support_tickets FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Support Comments
ALTER TABLE support_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their tickets"
  ON support_comments FOR SELECT
  USING (
    (
      ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()) AND
      is_internal = false
    ) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_comments.ticket_id
    )
  );

CREATE POLICY "Users can add comments to their tickets"
  ON support_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()) AND
    is_internal = false
  );

CREATE POLICY "Admins can add any comments"
  ON support_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_comments.ticket_id
    )
  );

-- Support Attachments
ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments on their tickets"
  ON support_attachments FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_attachments.ticket_id
    )
  );

CREATE POLICY "Users can upload attachments"
  ON support_attachments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- Support Ticket History
ALTER TABLE support_ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of their tickets"
  ON support_ticket_history FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_ticket_history.ticket_id
    )
  );

-- Support Notifications
ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON support_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON support_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON support_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload support attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'support-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view support attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'support-attachments' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'support_agent')
      )
    )
  );