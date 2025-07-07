-- Create canva_designs table to track design associations
CREATE TABLE public.canva_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_task_id UUID REFERENCES public.content_tasks(id) ON DELETE CASCADE,
  canva_design_id TEXT NOT NULL,
  original_image_url TEXT NOT NULL,
  final_image_url TEXT,
  design_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.canva_designs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own canva designs" 
ON public.canva_designs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own canva designs" 
ON public.canva_designs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canva designs" 
ON public.canva_designs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canva designs" 
ON public.canva_designs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_canva_designs_user_id ON public.canva_designs(user_id);
CREATE INDEX idx_canva_designs_content_task_id ON public.canva_designs(content_task_id);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_canva_designs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_canva_designs_updated_at
BEFORE UPDATE ON public.canva_designs
FOR EACH ROW
EXECUTE FUNCTION public.update_canva_designs_updated_at();