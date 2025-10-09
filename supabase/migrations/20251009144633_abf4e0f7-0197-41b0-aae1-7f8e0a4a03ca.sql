-- Phase 4: Add thumbnail to existing broken bundle
-- Use first image from a relevant Unsplash search as placeholder
UPDATE draft_snapshots
SET content = jsonb_set(
  jsonb_set(
    content,
    '{thumbnail}',
    '"https://images.unsplash.com/photo-1541963058-d6c01a428f68?w=800"'::jsonb
  ),
  '{recommendedImages}',
  '[
    {
      "url": "https://images.unsplash.com/photo-1541963058-d6c01a428f68?w=800",
      "thumb": "https://images.unsplash.com/photo-1541963058-d6c01a428f68?w=400",
      "alt": "Native American Heritage Month",
      "photographer": "Unsplash",
      "unsplashId": "placeholder"
    }
  ]'::jsonb
)
WHERE doc_id = 'd757ed34-ba55-49e4-983a-49c3ffb4af3d'
  AND doc_type = 'content_bundle';