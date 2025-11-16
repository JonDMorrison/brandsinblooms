-- Add INSERT policies for support_ticket_history to allow logging ticket changes

-- Super admins can insert ticket history for any ticket
CREATE POLICY "Super admins can insert ticket history"
ON support_ticket_history
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Users can insert history for their own tickets
CREATE POLICY "Users can insert history for their tickets"
ON support_ticket_history
FOR INSERT
WITH CHECK (
  ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = auth.uid()
  )
);