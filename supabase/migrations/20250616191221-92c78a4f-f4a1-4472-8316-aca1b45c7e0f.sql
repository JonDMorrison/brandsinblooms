
-- Enable Row Level Security on content_tasks table
ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;

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
