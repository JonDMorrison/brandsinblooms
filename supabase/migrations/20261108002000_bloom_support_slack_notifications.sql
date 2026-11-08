-- Optional staff-only Slack delivery for existing Bloom Support notification pipeline.
-- Disabled until Slack app is installed and Edge Function bot token/channels secured.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

INSERT INTO bloom_support.settings(key, value)
VALUES ('slack', '{"enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION bloom_support.notify_staff(p_ticket uuid, p_kind text, p_title text, p_audience text DEFAULT 'both')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owners jsonb := coalesce(bloom_support.setting('owners'), '{}'::jsonb);
  emails text[];
  first_notification uuid;
  slack_enabled boolean := coalesce(bloom_support.setting('slack')->>'enabled', 'false') = 'true';
BEGIN
  emails := ARRAY(
    SELECT lower(e) FROM jsonb_array_elements_text(
      CASE p_audience WHEN 'jon' THEN coalesce(owners->'jon','[]')
        WHEN 'jeff' THEN coalesce(owners->'jeff','[]')
        ELSE coalesce(owners->'jon','[]') || coalesce(owners->'jeff','[]') END) e);
  WITH inserted AS (
    INSERT INTO bloom_support.notifications(principal_id, ticket_id, kind, title)
    SELECT p.id, p_ticket, p_kind, p_title FROM bloom_support.principals p
    WHERE p.active AND (
      lower(p.email) = ANY(emails)
      OR (cardinality(emails) = 0 AND p.role = 'platform_admin')
      OR (p_audience IN ('jeff','both') AND cardinality(emails) = 0 AND p.role = 'platform_operator'))
    RETURNING id
  )
  SELECT id INTO first_notification FROM inserted LIMIT 1;

  -- One Slack job for the event, even when two principals receive notices.
  IF slack_enabled AND first_notification IS NOT NULL AND (
       p_kind LIKE 'ticket.%'
    OR p_kind LIKE 'engineering.%'
    OR p_kind LIKE 'feature.%'
    OR p_kind LIKE 'alert.%'
    OR p_kind LIKE 'escalation%'
    OR p_kind = 'job.dead'
    OR p_kind LIKE 'incident.%'
  ) THEN
    PERFORM bloom_support.enqueue_job(
      'notify', p_ticket, NULL,
      'slack:' || coalesce(p_ticket::text, 'platform'),
      jsonb_build_object('slack', true, 'kind', p_kind),
      CASE
        WHEN p_kind IN ('escalation.overdue','ticket.stalled','ticket.unassigned',
                        'ticket.overdue','response.missed','response.due_soon','next_action.overdue')
        THEN 'slack:daily:' || p_kind || ':' || coalesce(p_ticket::text, 'platform') || ':' ||
          to_char((now() AT TIME ZONE 'America/Vancouver')::date, 'YYYYMMDD')
        ELSE 'slack:notification:' || first_notification::text
      END,
      now(), 3, 30
    );
  END IF;
END $$;

COMMENT ON FUNCTION bloom_support.notify_staff(uuid,text,text,text) IS
  'Staff notifications with optional disabled-by-default privacy-safe Slack dispatch, using the existing leased queue.';
