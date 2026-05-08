DROP VIEW IF EXISTS content_library_view;

CREATE VIEW content_library_view AS
SELECT DISTINCT ON (ds.doc_id)
  ds.id AS snapshot_id,
  ds.user_id,
  ds.tenant_id AS workspace_id,
  ds.doc_id AS bundle_id,
  ds.version,
  ds.created_at,
  ds.updated_at,
  ds.deleted_at,
  (ds.content::jsonb ->> 'mode')::text AS mode,
  COALESCE(
    NULLIF(BTRIM(ds.content::jsonb ->> 'sourceLabel'), ''),
    preview.preview_title,
    'Untitled Content'
  ) AS source_label,
  COALESCE(
    preview.preview_title,
    NULLIF(BTRIM(ds.content::jsonb ->> 'sourceLabel'), '')
  ) AS preview_title,
  (ds.content::jsonb -> 'channels') AS channels,
  COALESCE(
    ds.content::jsonb ->> 'thumbnail',
    CASE
      WHEN jsonb_typeof(ds.content::jsonb -> 'recommendedImages') = 'array'
        AND jsonb_array_length(ds.content::jsonb -> 'recommendedImages') > 0 THEN
        ds.content::jsonb -> 'recommendedImages' -> 0 ->> 'url'
      ELSE NULL
    END,
    (
      SELECT item -> 'media' ->> 'url'
      FROM jsonb_array_elements(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) item
      WHERE NULLIF(item -> 'media' ->> 'url', '') IS NOT NULL
      LIMIT 1
    )
  ) AS thumbnail,
  (ds.content::jsonb -> 'recommendedImages') AS recommended_images,
  COALESCE((ds.content::jsonb ->> 'generationStatus')::text, 'ready') AS generation_status,
  NULLIF((ds.content::jsonb ->> 'generationError')::text, '') AS generation_error,
  COALESCE(
    (ds.content::jsonb -> 'generationContext' ->> 'hasMixedCarousel')::boolean,
    false
  ) AS has_mixed_carousel,
  jsonb_array_length(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) AS total_items,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) item
    WHERE (item ->> '_approved')::boolean = true
  ) AS approved_count
FROM draft_snapshots ds
LEFT JOIN LATERAL (
  SELECT NULLIF(
    BTRIM(
      LEFT(
        regexp_replace(
          COALESCE(
            NULLIF(BTRIM(item ->> 'title'), ''),
            NULLIF(BTRIM(item ->> 'summary'), ''),
            NULLIF(BTRIM(item ->> 'caption'), ''),
            NULLIF(BTRIM(item ->> 'script'), ''),
            NULLIF(BTRIM(item ->> 'body'), '')
          ),
          E'\\s+',
          ' ',
          'g'
        ),
        140
      )
    ),
    ''
  ) AS preview_title
  FROM jsonb_array_elements(COALESCE(ds.content::jsonb -> 'items', '[]'::jsonb)) item
  ORDER BY CASE item ->> 'channel'
    WHEN 'newsletter' THEN 1
    WHEN 'blog' THEN 2
    WHEN 'instagram' THEN 3
    WHEN 'facebook' THEN 4
    WHEN 'video' THEN 5
    ELSE 99
  END
  LIMIT 1
) preview ON true
WHERE ds.doc_type = 'content_bundle'
  AND ds.deleted_at IS NULL
  AND COALESCE(ds.content::jsonb ->> 'generationStatus', 'ready') = 'ready'
ORDER BY ds.doc_id, ds.version DESC, ds.updated_at DESC;