\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'bloom_search_benchmark' THEN RAISE EXCEPTION 'Disposable benchmark only'; END IF; END $$;
-- Give one wholly synthetic import the legacy schema; the benchmark computes
-- its synthetic certificate in memory. Never modifies production certificates.
WITH numbered AS (SELECT id,row_number() over(order by id) n FROM customer_intelligence_source_events WHERE import_id=md5('import2026')::uuid)
UPDATE customer_intelligence_source_events e SET raw_data=(raw_data-'source_sha256') || jsonb_build_object('source_filename','Synthetic 2026','dated_transactions',false,'columns',jsonb_build_array('product_code','product_name','department','quantity','net_amount','source_row'),'items',(SELECT jsonb_agg(jsonb_set(item,'{5}',to_jsonb(n.n*1000+ord)) ORDER BY ord) FROM jsonb_array_elements(raw_data->'items') WITH ORDINALITY i(item,ord))) FROM numbered n WHERE n.id=e.id;
