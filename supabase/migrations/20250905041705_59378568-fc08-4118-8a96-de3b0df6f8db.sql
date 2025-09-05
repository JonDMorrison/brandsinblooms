-- Remove the outdated check constraint that only allows 'newbie', 'struggler', 'regular', 'expert'
ALTER TABLE public.crm_customers DROP CONSTRAINT IF EXISTS crm_customers_persona_check;

-- Update any existing records with old persona values to null so they can be reassigned
UPDATE public.crm_customers 
SET persona = NULL 
WHERE persona IN ('newbie', 'struggler', 'regular', 'expert');

-- Add a more flexible constraint that allows proper persona names or null
ALTER TABLE public.crm_customers 
ADD CONSTRAINT crm_customers_persona_valid 
CHECK (persona IS NULL OR length(persona) > 0);