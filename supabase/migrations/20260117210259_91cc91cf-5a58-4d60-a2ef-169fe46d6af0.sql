-- Add overlap_behavior column to crm_automations
ALTER TABLE crm_automations 
ADD COLUMN IF NOT EXISTS overlap_behavior TEXT NOT NULL DEFAULT 'ignore';

COMMENT ON COLUMN crm_automations.overlap_behavior IS 
  'How to handle triggers when customer already has active run: 
   ignore = skip new trigger (current behavior), 
   restart = cancel existing and start fresh, 
   parallel = allow multiple concurrent runs, 
   queue = wait for current to finish then start';

-- Add run_sequence column to automation_runs for parallel mode
ALTER TABLE automation_runs 
ADD COLUMN IF NOT EXISTS run_sequence INTEGER NOT NULL DEFAULT 1;

-- Add queued_until column to automation_trigger_events for queue mode
ALTER TABLE automation_trigger_events 
ADD COLUMN IF NOT EXISTS queued_until TIMESTAMPTZ;

-- Drop old unique index that blocks overlapping runs
DROP INDEX IF EXISTS idx_automation_runs_active_unique;

-- Create new unique index that includes run_sequence (allows parallel runs)
CREATE UNIQUE INDEX idx_automation_runs_active_unique 
ON automation_runs (automation_id, customer_id, run_sequence) 
WHERE status IN ('active', 'paused');

-- Index for efficient queued event lookup
CREATE INDEX IF NOT EXISTS idx_trigger_events_queued 
ON automation_trigger_events (queued_until) 
WHERE queued_until IS NOT NULL AND processed_at IS NULL;