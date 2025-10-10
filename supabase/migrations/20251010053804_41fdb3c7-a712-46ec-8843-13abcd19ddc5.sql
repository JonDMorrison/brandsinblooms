-- Add is_favorite column to saved_blocks table
ALTER TABLE public.saved_blocks 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;