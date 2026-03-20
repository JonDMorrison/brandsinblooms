-- Milestone 3: ensure email_tracking_events rows can be subscribed to with
-- strict tenant_id + campaign_id realtime filters.

WITH campaign_tenants AS (
  SELECT
    c.id AS campaign_id,
    COALESCE(
      c.tenant_id,
      owner.tenant_id,
      segment.tenant_id,
      linked_segment.tenant_id
    ) AS tenant_id
  FROM public.crm_campaigns c
  LEFT JOIN public.users owner ON owner.id = c.user_id
  LEFT JOIN public.crm_segments segment ON segment.id = c.segment_id
  LEFT JOIN LATERAL (
    SELECT s.tenant_id
    FROM public.campaign_segments cs
    JOIN public.crm_segments s ON s.id = cs.segment_id
    WHERE cs.campaign_id = c.id
    LIMIT 1
  ) linked_segment ON true
)
UPDATE public.email_tracking_events ete
SET tenant_id = campaign_tenants.tenant_id
FROM campaign_tenants
WHERE ete.campaign_id = campaign_tenants.campaign_id
  AND ete.tenant_id IS NULL
  AND campaign_tenants.tenant_id IS NOT NULL;

ALTER TABLE public.email_tracking_events
  DROP CONSTRAINT IF EXISTS email_tracking_events_tenant_id_present_chk;

ALTER TABLE public.email_tracking_events
  ADD CONSTRAINT email_tracking_events_tenant_id_present_chk
  CHECK (tenant_id IS NOT NULL) NOT VALID;