-- Purchase dates from dated IdealPOS journal receipts.
--
-- first_purchase_date, last_purchase_date / last_visit_date and pos_order_count
-- come from completed journal imports only. A customer with purchase activity
-- in a report period after the newest journal (an undated spending or product
-- report) bought again on an unknown day, so their last purchase stays blank
-- rather than marking them Lapsed. Spend totals are not written: the journals
-- do not cover every year, and a partial total is not lifetime value.
CREATE OR REPLACE FUNCTION public.ideal_journal_refresh_customer_dates(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' SET enable_indexscan = off AS $$
DECLARE v_journal_end date; v_dated integer; v_later integer;
BEGIN
  SELECT max(source_period_end) INTO v_journal_end FROM public.customer_intelligence_imports
  WHERE tenant_id = p_tenant_id AND source = 'ideal' AND report_type = 'journal' AND status = 'completed';
  IF v_journal_end IS NULL THEN RAISE EXCEPTION 'No completed journal import'; END IF;

  WITH journal AS (
    SELECT id FROM public.customer_intelligence_imports
    WHERE tenant_id = p_tenant_id AND source = 'ideal' AND report_type = 'journal' AND status = 'completed'
  ), dated AS (
    SELECT li.customer_id, min(li.purchased_at) AS first_at, max(li.purchased_at) AS last_at,
           count(DISTINCT li.import_id::text || li.external_transaction_id) AS receipts
    FROM public.customer_purchase_line_items li JOIN journal j ON j.id = li.import_id
    WHERE li.customer_id IS NOT NULL
    GROUP BY li.customer_id
  ), later AS (
    -- Undated reports after the journals: spending (amount > 0) or product totals.
    SELECT DISTINCT e.customer_id
    FROM public.customer_intelligence_imports i
    JOIN public.customer_intelligence_source_events e ON e.import_id = i.id
    WHERE i.tenant_id = p_tenant_id AND i.source = 'ideal' AND i.status = 'completed'
      AND i.report_type IN ('customer_spending', 'customer_sales_summary')
      AND i.source_period_end > v_journal_end AND e.customer_id IS NOT NULL
      AND coalesce(e.amount, 1) <> 0
  ), upd AS (
    UPDATE public.crm_customers c
    SET first_purchase_date = (d.first_at AT TIME ZONE 'America/Vancouver')::date,
        last_purchase_date = CASE WHEN l.customer_id IS NULL THEN (d.last_at AT TIME ZONE 'America/Vancouver')::date END,
        last_visit_date = CASE WHEN l.customer_id IS NULL THEN d.last_at END,
        pos_order_count = d.receipts
    FROM dated d LEFT JOIN later l ON l.customer_id = d.customer_id
    WHERE c.id = d.customer_id AND c.tenant_id = p_tenant_id AND c.deleted_at IS NULL
    RETURNING (l.customer_id IS NOT NULL) AS has_later
  ) SELECT count(*), count(*) FILTER (WHERE has_later) INTO v_dated, v_later FROM upd;

  RETURN jsonb_build_object('customers_dated', v_dated, 'last_purchase_unknown_after', v_journal_end, 'later_activity_customers', v_later);
END $$;

REVOKE ALL ON FUNCTION public.ideal_journal_refresh_customer_dates(uuid) FROM PUBLIC, anon, authenticated;
