-- Remove the retired "- Newsletter -" stock photo (/images/newsletter-fallback.jpg)
-- from campaigns that can still be edited or sent. The file itself is deleted
-- from the app, so any remaining reference would render a broken image.
--
-- Scope: blocks of DRAFT and SCHEDULED crm_campaigns only. Sent, failed,
-- paused campaigns and blocks whose campaign no longer exists are never touched.
-- A JSON string value containing the path becomes "" (no image), which the
-- editor shows as the neutral "Add a photo" frame and sent mail omits.

with editable as (
  select b.id
  from public.campaign_blocks b
  join public.crm_campaigns c on c.id = b.campaign_id
  where c.status in ('draft', 'scheduled')
    and (
      b.image_url like '%newsletter-fallback%'
      or b.content::text like '%newsletter-fallback%'
      or b.layout_settings::text like '%newsletter-fallback%'
    )
)
update public.campaign_blocks b
set
  image_url = case when b.image_url like '%newsletter-fallback%' then '' else b.image_url end,
  content = case
    when b.content::text like '%newsletter-fallback%'
      then regexp_replace(b.content::text, '"[^"]*newsletter-fallback[^"]*"', '""', 'g')::jsonb
    else b.content
  end,
  layout_settings = case
    when b.layout_settings::text like '%newsletter-fallback%'
      then regexp_replace(b.layout_settings::text, '"[^"]*newsletter-fallback[^"]*"', '""', 'g')::jsonb
    else b.layout_settings
  end
from editable
where b.id = editable.id;
