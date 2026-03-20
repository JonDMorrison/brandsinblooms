-- FIX: [issue #55] - Replace ineffective UNIQUE constraint with partial unique indexes
ALTER TABLE customer_personas DROP CONSTRAINT IF EXISTS customer_personas_customer_id_persona_id_predefined_persona__key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_personas_unique_custom
  ON customer_personas (customer_id, persona_id)
  WHERE persona_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_personas_unique_predefined
  ON customer_personas (customer_id, predefined_persona_id)
  WHERE predefined_persona_id IS NOT NULL;

-- FIX: [issue #56] - Add INSERT/UPDATE policies for customer_timeline_events
CREATE POLICY IF NOT EXISTS "Users can insert timeline events for their tenant" ON customer_timeline_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM crm_customers c JOIN public.users u ON u.tenant_id = c.tenant_id WHERE c.id = customer_timeline_events.customer_id AND u.id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can update timeline events for their tenant" ON customer_timeline_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM crm_customers c JOIN public.users u ON u.tenant_id = c.tenant_id WHERE c.id = customer_timeline_events.customer_id AND u.id = auth.uid())
  );

-- FIX: [issue #57] - Add DELETE policy for customer_consents (for GDPR data erasure requests)
CREATE POLICY IF NOT EXISTS "Users can delete consents for their tenant" ON customer_consents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM crm_customers c JOIN public.users u ON u.tenant_id = c.tenant_id WHERE c.id = customer_consents.customer_id AND u.id = auth.uid())
  );
