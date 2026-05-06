DROP VIEW IF EXISTS content_library_view;

CREATE VIEW content_library_view AS
SELECT
  ds.id AS snapshot_id,
  ds.user_id,
  ds.tenant_id AS workspace_id,
  ds.doc_id AS bundle_id,
  ds.version,
  ds.created_at,
  ds.updated_at,
  ds.deleted_at,
  (ds.content::jsonb ->> 'mode')::text AS mode,
  (ds.content::jsonb ->> 'sourceLabel')::text AS source_label,
  (ds.content::jsonb -> 'channels')::jsonb AS channels,
  (ds.content::jsonb ->> 'thumbnail')::text AS thumbnail,
  (ds.content::jsonb -> 'recommendedImages')::jsonb AS recommended_images,
  COALESCE((ds.content::jsonb ->> 'generationStatus')::text, 'ready') AS generation_status,
  NULLIF((ds.content::jsonb ->> 'generationError')::text, '') AS generation_error,
  jsonb_array_length(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) AS total_items,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) item
    WHERE (item ->> '_approved')::boolean = true
  ) AS approved_count
FROM draft_snapshots ds
WHERE ds.doc_type = 'content_bundle'
  AND ds.deleted_at IS NULL
  AND COALESCE(ds.content::jsonb ->> 'generationStatus', 'ready') = 'ready'
ORDER BY ds.updated_at DESC;