-- Add persona confidence score to crm_customers table
ALTER TABLE public.crm_customers 
ADD COLUMN persona_confidence_score DECIMAL DEFAULT 0.75,
ADD COLUMN persona_assignment_method TEXT DEFAULT 'manual';

-- Update existing records to have manual assignment method
UPDATE public.crm_customers 
SET persona_assignment_method = 'manual' 
WHERE persona_assignment_method IS NULL;