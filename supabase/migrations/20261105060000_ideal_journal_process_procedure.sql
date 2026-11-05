-- Runs staged journal years end to end, committing after every step, so a
-- one-off pg_cron job can do the slow report writes without a client waiting.
-- Each step is idempotent: a rerun continues where the last one stopped.
-- No SET clause: a procedure with one cannot commit. Every name is schema-qualified.
CREATE OR REPLACE PROCEDURE public.ideal_journal_process(p_batches text[], p_annual_totals boolean[], p_parts integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_batch text; v_import uuid; v_seq integer; v_status text; v_i integer; v_part integer;
BEGIN
  FOR v_i IN 1 .. coalesce(array_length(p_batches, 1), 0) LOOP
    v_batch := p_batches[v_i];
    IF EXISTS (SELECT 1 FROM public.ideal_journal_staging WHERE batch_id = v_batch) THEN
      v_import := public.ideal_journal_open_import(v_batch);
      COMMIT;
      FOR v_seq IN SELECT seq FROM public.ideal_journal_staging WHERE batch_id = v_batch ORDER BY seq LOOP
        PERFORM public.ideal_journal_apply_chunk(v_batch, v_seq);
        COMMIT;
      END LOOP;
      PERFORM public.ideal_journal_finish(v_batch, false);
      COMMIT;
    END IF;
    SELECT id INTO v_import FROM public.customer_intelligence_imports
    WHERE report_type = 'journal' AND status = 'completed' AND reconciliation->>'staging_batch' = v_batch;
    IF v_import IS NULL THEN RAISE EXCEPTION 'Journal % did not complete', v_batch; END IF;
    IF p_annual_totals[v_i] THEN
      SELECT status INTO v_status FROM public.customer_intelligence_imports i
      WHERE i.report_type = 'customer_sales_summary'
        AND i.source_sha256 = (SELECT source_sha256 FROM public.customer_intelligence_imports WHERE id = v_import);
      IF v_status IS DISTINCT FROM 'completed' THEN
        FOR v_part IN 0 .. p_parts - 1 LOOP
          PERFORM public.ideal_journal_write_annual_totals(v_import, v_part, p_parts);
          COMMIT;
        END LOOP;
        PERFORM public.ideal_journal_complete_annual_totals(v_import);
        COMMIT;
      END IF;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON PROCEDURE public.ideal_journal_process(text[], boolean[], integer) FROM PUBLIC, anon, authenticated;
