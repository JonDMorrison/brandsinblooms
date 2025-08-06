-- Create tutorial_progress table for tracking user tour completion
CREATE TABLE public.tutorial_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  step TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure users can only have one progress record per step
  UNIQUE(user_id, step)
);

-- Enable RLS
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tutorial progress" 
ON public.tutorial_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutorial progress" 
ON public.tutorial_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutorial progress" 
ON public.tutorial_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_tutorial_progress_user_id ON public.tutorial_progress(user_id);
CREATE INDEX idx_tutorial_progress_step ON public.tutorial_progress(user_id, step);

-- Add beta_tour_enabled flag to company_profiles for feature gating
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS beta_tour_enabled BOOLEAN DEFAULT true;