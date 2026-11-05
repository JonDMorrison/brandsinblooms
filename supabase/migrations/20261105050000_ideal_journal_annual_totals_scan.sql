-- One journal year's lines are stored together. A plain index scan fetched
-- them in customer order, one random page at a time (80 s per batch); a
-- bitmap scan reads them in storage order (2 s for the whole year).
ALTER FUNCTION public.ideal_journal_write_annual_totals(uuid, integer, integer) SET enable_indexscan = off;
ALTER FUNCTION public.ideal_journal_complete_annual_totals(uuid) SET enable_indexscan = off;
ALTER FUNCTION public.ideal_journal_finish(text, boolean) SET enable_indexscan = off;

-- Bulk report writes go to the trigram index's pending list instead of
-- rewriting index pages row by row; gin_clean_pending_list merges it after.
ALTER INDEX public.customer_intelligence_summary_items_trgm_idx SET (fastupdate = on, gin_pending_list_limit = 262144);
