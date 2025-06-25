
-- Add new columns to content_tasks table for enhanced posting tracking
ALTER TABLE content_tasks 
ADD COLUMN posting_attempts integer DEFAULT 0,
ADD COLUMN last_posting_error text,
ADD COLUMN posting_disabled_at timestamp with time zone,
ADD COLUMN platform_post_id text,
ADD COLUMN platform_post_url text;

-- Add analytics dashboard feature flag to company_profiles
UPDATE company_profiles 
SET feature_flags = feature_flags || '{"analytics_dashboard_v1": false}'::jsonb
WHERE NOT (feature_flags ? 'analytics_dashboard_v1');

-- Create table for tracking post performance metrics
CREATE TABLE IF NOT EXISTS post_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_task_id uuid REFERENCES content_tasks(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_post_id text NOT NULL,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,
  engagement_rate decimal(5,2) DEFAULT 0,
  collected_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on post_performance table
ALTER TABLE post_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for post_performance
CREATE POLICY "Users can view their own post performance" 
  ON post_performance 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM content_tasks ct 
      WHERE ct.id = post_performance.content_task_id 
      AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own post performance" 
  ON post_performance 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_tasks ct 
      WHERE ct.id = post_performance.content_task_id 
      AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own post performance" 
  ON post_performance 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM content_tasks ct 
      WHERE ct.id = post_performance.content_task_id 
      AND ct.user_id = auth.uid()
    )
  );
