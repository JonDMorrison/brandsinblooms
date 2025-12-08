
-- Drop the foreign key constraint that only allows pos_connections IDs
-- This allows pos_orders to be used with both Lightspeed (pos_connections) and Square (square_connections)
-- RLS policies already handle access control for both connection types

ALTER TABLE pos_orders DROP CONSTRAINT IF EXISTS pos_orders_pos_connection_id_fkey;

-- Add a comment explaining the column can reference either pos_connections or square_connections
COMMENT ON COLUMN pos_orders.pos_connection_id IS 'References either pos_connections.id (Lightspeed) or square_connections.id (Square). Access controlled via RLS policies.';
