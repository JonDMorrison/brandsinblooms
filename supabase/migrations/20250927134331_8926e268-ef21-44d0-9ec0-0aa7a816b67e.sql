-- Update content_library_view to include proper thumbnail data from draft_snapshots
DROP VIEW IF EXISTS content_library_view;

CREATE VIEW content_library_view AS
SELECT DISTINCT ON (ds.doc_id)
  ds.id as snapshot_id,
  u.tenant_id as workspace_id,
  ds.doc_id as bundle_id,
  ds.content->>'mode' as mode,
  ds.content->>'sourceId' as source_id,
  COALESCE(ds.content->>'sourceLabel', ds.content->>'title') as source_label,
  CASE 
    WHEN jsonb_typeof(ds.content->'channels') = 'array' THEN
      ARRAY(SELECT jsonb_array_elements_text(ds.content->'channels'))
    ELSE 
      ARRAY[]::text[]
  END as channels,
  COALESCE(
    (SELECT COUNT(*) FROM jsonb_array_elements(ds.content->'items') item WHERE (item->>'_approved')::boolean = true),
    0
  ) as approved_count,
  COALESCE(jsonb_array_length(ds.content->'items'), 0) as total_items,
  -- Extract thumbnail from multiple possible sources
  COALESCE(
    ds.content->>'thumbnail',
    ds.content->>'featuredImage',
    CASE 
      WHEN ds.content->'recommendedImages' IS NOT NULL AND jsonb_array_length(ds.content->'recommendedImages') > 0 THEN
        ds.content->'recommendedImages'->0->>'url'
      ELSE NULL
    END,
    -- Also check if any items have images
    (SELECT item->'media'->>'url' 
     FROM jsonb_array_elements(COALESCE(ds.content->'items', '[]'::jsonb)) item 
     WHERE item->'media'->>'url' IS NOT NULL 
     LIMIT 1)
  ) as thumbnail,
  ds.created_at,
  ds.updated_at
FROM draft_snapshots ds
JOIN users u ON u.id = ds.user_id
WHERE ds.doc_type = 'content_bundle' 
  AND ds.deleted_at IS NULL
ORDER BY ds.doc_id, ds.version DESC;