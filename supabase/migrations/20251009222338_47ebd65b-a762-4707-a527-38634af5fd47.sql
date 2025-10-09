-- Phase 1: Update content_library_view to expose thumbnail and recommendedImages from bundle JSON
-- This will allow the frontend to display the images that are already being saved

DROP VIEW IF EXISTS content_library_view;

CREATE VIEW content_library_view AS
SELECT 
  ds.id as snapshot_id,
  ds.user_id,
  ds.tenant_id as workspace_id,
  ds.doc_id as bundle_id,
  ds.version,
  ds.created_at,
  ds.updated_at,
  ds.deleted_at,
  
  -- Extract bundle metadata from JSON
  (ds.content::jsonb ->> 'mode')::text as mode,
  (ds.content::jsonb ->> 'sourceLabel')::text as source_label,
  (ds.content::jsonb -> 'channels')::jsonb as channels,
  
  -- Extract image data from JSON (NEW)
  (ds.content::jsonb ->> 'thumbnail')::text as thumbnail,
  (ds.content::jsonb -> 'recommendedImages')::jsonb as recommended_images,
  
  -- Count items
  jsonb_array_length(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) as total_items,
  
  -- Count approved items
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(ds.content::jsonb -> 'items') item
    WHERE (item ->> '_approved')::boolean = true
  ) as approved_count
  
FROM draft_snapshots ds
WHERE ds.doc_type = 'content_bundle'
  AND ds.deleted_at IS NULL
ORDER BY ds.updated_at DESC;