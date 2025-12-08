-- Add fulfillment and refund tracking columns to pos_orders
ALTER TABLE pos_orders 
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_state TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add index for fulfillment state queries
CREATE INDEX IF NOT EXISTS idx_pos_orders_fulfillment_state ON pos_orders(fulfillment_state) WHERE fulfillment_state IS NOT NULL;

-- Add index for refunded orders
CREATE INDEX IF NOT EXISTS idx_pos_orders_refunded ON pos_orders(refunded_at) WHERE refunded_at IS NOT NULL;