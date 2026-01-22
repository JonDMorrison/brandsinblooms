
UPDATE public.subscriptions 
SET end_date = (NOW() + INTERVAL '6 months')::date
WHERE id = '8a25f23d-28de-4b7b-a134-2f7b3ed55c1b';
