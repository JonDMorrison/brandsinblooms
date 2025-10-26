
-- Make content_id nullable to support new schema with task_id
-- Old posts use content_id -> generated_content
-- New posts use task_id -> content_tasks
ALTER TABLE public.scheduled_posts 
ALTER COLUMN content_id DROP NOT NULL;

-- Add comment explaining the schema evolution
COMMENT ON COLUMN public.scheduled_posts.content_id IS 'Legacy: references generated_content. For new posts, use task_id instead.';
COMMENT ON COLUMN public.scheduled_posts.task_id IS 'New schema: references content_tasks. Replaces content_id for new workflow.';
