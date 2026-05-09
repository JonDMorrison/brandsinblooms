WITH ranked_post_performance AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY content_task_id, platform
      ORDER BY collected_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_rank
  FROM post_performance
  WHERE content_task_id IS NOT NULL
)
DELETE FROM post_performance AS existing_row
USING ranked_post_performance AS ranked_row
WHERE existing_row.id = ranked_row.id
  AND ranked_row.row_rank > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'post_performance_content_task_platform_key'
  ) THEN
    ALTER TABLE post_performance
      ADD CONSTRAINT post_performance_content_task_platform_key
      UNIQUE (content_task_id, platform);
  END IF;
END $$;