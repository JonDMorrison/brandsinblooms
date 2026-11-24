-- QA pass 4 #7: indexes for global search on customers.
--
-- search-entities filters crm_customers with ilike '%term%' (and 'term%')
-- on first_name, last_name, email and phone, OR-ed together. With no
-- per-column trigram index Postgres scanned the whole tenant: 1.36 s for the
-- 107k-customer tenant before RLS, close to the function's 1.75 s query
-- timeout. With these indexes the same query is a BitmapOr of index scans
-- (2 ms).
--
-- On production these were built with CREATE INDEX CONCURRENTLY (no write
-- lock on crm_customers) before this migration was recorded; IF NOT EXISTS
-- makes the migration a no-op there and builds them elsewhere.

create index if not exists idx_crm_customers_first_name_trgm
  on public.crm_customers using gin (first_name gin_trgm_ops);
create index if not exists idx_crm_customers_last_name_trgm
  on public.crm_customers using gin (last_name gin_trgm_ops);
create index if not exists idx_crm_customers_email_trgm
  on public.crm_customers using gin (email gin_trgm_ops);
create index if not exists idx_crm_customers_phone_trgm
  on public.crm_customers using gin (phone gin_trgm_ops);
