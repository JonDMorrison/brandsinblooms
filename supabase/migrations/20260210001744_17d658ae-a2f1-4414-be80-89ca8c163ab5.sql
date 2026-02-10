-- Un-suppress Christine's customer record so she can receive SMS and email
UPDATE public.crm_customers
SET suppressed = false, updated_at = now()
WHERE id = '4f3d15d7-be9b-4ed9-9fe5-cb8d0c6dffd6';