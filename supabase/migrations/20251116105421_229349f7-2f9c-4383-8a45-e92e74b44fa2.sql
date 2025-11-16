-- Fix ambiguous column references in support system RLS policies

-- Drop and recreate policies with proper column qualification

-- Support Comments: Fix ambiguous references
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON support_comments;
DROP POLICY IF EXISTS "Admins can add any comments" ON support_comments;

CREATE POLICY "Users can view comments on their tickets"
  ON support_comments FOR SELECT
  USING (
    (
      support_comments.ticket_id IN (
        SELECT st.id FROM support_tickets st WHERE st.user_id = auth.uid()
      ) AND
      support_comments.is_internal = false
    ) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_comments.ticket_id
    )
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

-- Support Attachments: Fix ambiguous references
DROP POLICY IF EXISTS "Users can view attachments on their tickets" ON support_attachments;

CREATE POLICY "Users can view attachments on their tickets"
  ON support_attachments FOR SELECT
  USING (
    support_attachments.ticket_id IN (
      SELECT st.id FROM support_tickets st WHERE st.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_attachments.ticket_id
    )
  );

-- Support Ticket History: Fix ambiguous references
DROP POLICY IF EXISTS "Users can view history of their tickets" ON support_ticket_history;

CREATE POLICY "Users can view history of their tickets"
  ON support_ticket_history FOR SELECT
  USING (
    support_ticket_history.ticket_id IN (
      SELECT st.id FROM support_tickets st WHERE st.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN support_tickets st ON st.tenant_id = u.tenant_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin', 'support_agent')
      AND st.id = support_ticket_history.ticket_id
    )
  );