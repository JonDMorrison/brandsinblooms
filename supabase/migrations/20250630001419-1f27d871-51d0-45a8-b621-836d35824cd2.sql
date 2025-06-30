
-- Add post_mode enum type
CREATE TYPE post_mode AS ENUM ('AUTO', 'MANUAL');

-- Add mode column to scheduled_posts table
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS mode post_mode NOT NULL DEFAULT 'AUTO';
