
-- Enable RLS on content_tasks table (if not already enabled)
ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own content tasks" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can create content tasks for their own campaigns" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can update their own content tasks" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can delete their own content tasks" ON public.content_tasks;

-- Create policy for SELECT - users can only view content tasks for their own campaigns
CREATE POLICY "Users can view their own content tasks" 
  ON public.content_tasks 
  FOR SELECT 
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );

-- Create policy for INSERT - users can only create content tasks for their own campaigns
CREATE POLICY "Users can create content tasks for their own campaigns" 
  ON public.content_tasks 
  FOR INSERT 
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );

-- Create policy for UPDATE - users can only update their own content tasks
CREATE POLICY "Users can update their own content tasks" 
  ON public.content_tasks 
  FOR UPDATE 
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );

-- Create policy for DELETE - users can only delete their own content tasks
CREATE POLICY "Users can delete their own content tasks" 
  ON public.content_tasks 
  FOR DELETE 
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );
