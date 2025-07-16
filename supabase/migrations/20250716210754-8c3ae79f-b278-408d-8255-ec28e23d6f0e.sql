-- Add persona_id to crm_segments table to link segments to personas
ALTER TABLE public.crm_segments 
ADD COLUMN persona_id UUID REFERENCES public.personas(id);

-- Add index for better performance
CREATE INDEX idx_crm_segments_persona_id ON public.crm_segments(persona_id);