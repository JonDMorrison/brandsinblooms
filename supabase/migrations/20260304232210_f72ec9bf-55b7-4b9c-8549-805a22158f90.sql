UPDATE crm_campaigns 
SET metrics = jsonb_build_object(
  'totals', jsonb_build_object(
    'sent', 19013,
    'delivered', 16403,
    'opens', 0,
    'clicks', 1738,
    'bounces', 146,
    'complaints', 2,
    'unsubscribes', 0
  ),
  'rates', jsonb_build_object(
    'open_reported', 0,
    'open_adjusted', 0,
    'click', 9.14,
    'bounce', 0.77,
    'complaint', 0.01
  ),
  'computed_at', now()
)
WHERE id = '96e1a382-81e4-4120-8fdb-c823d5f006e6';