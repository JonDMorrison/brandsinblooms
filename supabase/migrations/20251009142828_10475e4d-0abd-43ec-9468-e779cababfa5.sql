-- Phase 4: Fix existing broken bundle with missing metadata
UPDATE draft_snapshots
SET content = jsonb_set(
  jsonb_set(
    jsonb_set(
      content,
      '{mode}', '"holiday"'
    ),
    '{sourceLabel}', '"Native American Heritage Month"'
  ),
  '{channels}', '["instagram", "facebook", "newsletter", "video", "blog"]'::jsonb
)
WHERE doc_id = 'd757ed34-ba55-49e4-983a-49c3ffb4af3d'
  AND doc_type = 'content_bundle';