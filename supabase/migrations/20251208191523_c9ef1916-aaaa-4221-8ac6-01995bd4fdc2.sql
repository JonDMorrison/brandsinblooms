-- Drop existing SELECT-only policy
DROP POLICY IF EXISTS "Users can view orders from their POS connections" ON pos_orders;

-- Create new SELECT policy that checks both pos_connections (Lightspeed) and square_connections (Square)
CREATE POLICY "Users can view orders from their POS connections"
  ON pos_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pos_connections pc
      WHERE pc.id = pos_orders.pos_connection_id
      AND pc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM square_connections sc
      WHERE sc.id = pos_orders.pos_connection_id
      AND sc.user_id = auth.uid()
    )
  );

-- Create INSERT policy for both connection types
CREATE POLICY "Users can insert orders for their POS connections"
  ON pos_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pos_connections pc
      WHERE pc.id = pos_orders.pos_connection_id
      AND pc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM square_connections sc
      WHERE sc.id = pos_orders.pos_connection_id
      AND sc.user_id = auth.uid()
    )
  );

-- Create UPDATE policy for both connection types
CREATE POLICY "Users can update orders for their POS connections"
  ON pos_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pos_connections pc
      WHERE pc.id = pos_orders.pos_connection_id
      AND pc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM square_connections sc
      WHERE sc.id = pos_orders.pos_connection_id
      AND sc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pos_connections pc
      WHERE pc.id = pos_orders.pos_connection_id
      AND pc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM square_connections sc
      WHERE sc.id = pos_orders.pos_connection_id
      AND sc.user_id = auth.uid()
    )
  );