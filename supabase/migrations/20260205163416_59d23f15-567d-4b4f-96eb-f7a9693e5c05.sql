-- Unpause the dwn2earth.com domain and reset bounce stats (caused by mass-suppression incident)
UPDATE email_domains 
SET 
  status = 'active',
  bounce_rate_30d = 0,
  total_bounces_30d = 0,
  total_sent_30d = 0,
  notes = notes || E'\n[2026-02-05] Manually unpaused by admin. Bounce stats reset (mass-suppression incident recovery).'
WHERE id = 'b88ac159-acb2-4d0c-ba81-8ab809219c4d'
  AND tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62';