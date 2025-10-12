-- Add RLS policies for import_jobs table
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own import jobs
CREATE POLICY "Users can view their own import jobs"
ON public.import_jobs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create their own import jobs
CREATE POLICY "Users can create their own import jobs"
ON public.import_jobs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own import jobs
CREATE POLICY "Users can update their own import jobs"
ON public.import_jobs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own import jobs
CREATE POLICY "Users can delete their own import jobs"
ON public.import_jobs
FOR DELETE
TO authenticated
USING (user_id = auth.uid());