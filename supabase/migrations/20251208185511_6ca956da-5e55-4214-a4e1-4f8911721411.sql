-- Add setup_wizard_completed_at column to track wizard completion
ALTER TABLE public.square_connections 
ADD COLUMN IF NOT EXISTS setup_wizard_completed_at TIMESTAMP WITH TIME ZONE;