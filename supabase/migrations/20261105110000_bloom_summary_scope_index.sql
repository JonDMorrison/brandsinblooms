-- Bloom's evidence-scope step lists which customers have report rows. It read
-- every report row from the table (160 MB for five yearly reports). This index
-- carries every column that step filters on or returns, so it can be answered
-- from the index alone once the table is vacuumed.
CREATE INDEX IF NOT EXISTS customer_intelligence_summary_scope_idx
  ON public.customer_intelligence_source_events (tenant_id, import_id)
  INCLUDE (customer_id, source, created_at)
  WHERE event_type = 'purchase_summary';
