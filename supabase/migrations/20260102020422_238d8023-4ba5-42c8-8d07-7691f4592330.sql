-- Create automation_trigger_events table to queue real-time segment/persona trigger events
CREATE TABLE IF NOT EXISTS public.automation_trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES crm_automations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES crm_segments(id) ON DELETE SET NULL,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient processing of unprocessed events
CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_unprocessed 
  ON automation_trigger_events(created_at) 
  WHERE processed_at IS NULL;

-- Index for querying by automation
CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_automation 
  ON automation_trigger_events(automation_id);

-- Index for querying by customer
CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_customer 
  ON automation_trigger_events(customer_id);

-- Enable Row Level Security
ALTER TABLE automation_trigger_events ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view their tenant's trigger events
CREATE POLICY "Users can view their tenant trigger events"
  ON automation_trigger_events FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

-- Function to trigger automation when a customer is added to a segment
CREATE OR REPLACE FUNCTION public.trigger_segment_automation()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
BEGIN
  -- Find active automations with segment.added trigger for this segment
  FOR automation_record IN
    SELECT id, tenant_id
    FROM crm_automations
    WHERE is_active = true
      AND (
        trigger_type = 'segment.added' 
        OR trigger_type = 'segment_added'
      )
      AND (
        trigger_conditions->>'segment_id' = NEW.segment_id::text
        OR (flow_state->'nodes'->0->'data'->'conditions'->>'segment_id') = NEW.segment_id::text
      )
  LOOP
    -- Insert trigger event into the queue
    INSERT INTO automation_trigger_events (
      automation_id,
      customer_id,
      segment_id,
      tenant_id,
      event_type,
      created_at
    ) VALUES (
      automation_record.id,
      NEW.customer_id,
      NEW.segment_id,
      automation_record.tenant_id,
      'segment.added',
      NOW()
    );
    
    RAISE LOG 'Queued automation trigger event: automation=%, customer=%, segment=%', 
      automation_record.id, NEW.customer_id, NEW.segment_id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on customer_segments table
DROP TRIGGER IF EXISTS on_customer_segment_added ON customer_segments;
CREATE TRIGGER on_customer_segment_added
  AFTER INSERT ON customer_segments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_segment_automation();

-- Function to trigger automation when a customer is assigned to a persona
CREATE OR REPLACE FUNCTION public.trigger_persona_automation()
RETURNS TRIGGER AS $$
DECLARE
  automation_record RECORD;
BEGIN
  -- Find active automations with persona.assigned trigger for this persona
  FOR automation_record IN
    SELECT id, tenant_id
    FROM crm_automations
    WHERE is_active = true
      AND (
        trigger_type = 'persona.assigned' 
        OR trigger_type = 'persona_assigned'
      )
      AND (
        trigger_conditions->>'persona_id' = NEW.persona_id::text
        OR (flow_state->'nodes'->0->'data'->'conditions'->>'persona_id') = NEW.persona_id::text
      )
  LOOP
    -- Insert trigger event into the queue
    INSERT INTO automation_trigger_events (
      automation_id,
      customer_id,
      persona_id,
      tenant_id,
      event_type,
      created_at
    ) VALUES (
      automation_record.id,
      NEW.customer_id,
      NEW.persona_id,
      automation_record.tenant_id,
      'persona.assigned',
      NOW()
    );
    
    RAISE LOG 'Queued automation trigger event: automation=%, customer=%, persona=%', 
      automation_record.id, NEW.customer_id, NEW.persona_id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on customer_personas table
DROP TRIGGER IF EXISTS on_customer_persona_assigned ON customer_personas;
CREATE TRIGGER on_customer_persona_assigned
  AFTER INSERT ON customer_personas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_persona_automation();