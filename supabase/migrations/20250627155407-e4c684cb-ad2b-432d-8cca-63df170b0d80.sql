
-- Add the attachments column to content_tasks table
ALTER TABLE public.content_tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Add an index for better performance when searching attachments
CREATE INDEX IF NOT EXISTS content_tasks_attachments_gin 
ON public.content_tasks USING gin (attachments);

-- Reload PostgREST schema cache to recognize the new column
NOTIFY pgrst, 'reload schema';
