-- Complete Phase 1: Fix remaining items after partial migration

-- Drop existing partial index if it exists
DROP INDEX IF EXISTS idx_customer_risk_signals_churn;

-- Add the churn_probability column if missing (wrapped in DO block for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_risk_signals' AND column_name = 'churn_probability'
  ) THEN
    ALTER TABLE customer_risk_signals ADD COLUMN churn_probability NUMERIC(5,4) DEFAULT 0;
  END IF;
END $$;

-- Now create the index
CREATE INDEX IF NOT EXISTS idx_customer_risk_signals_churn 
  ON customer_risk_signals(churn_probability DESC);