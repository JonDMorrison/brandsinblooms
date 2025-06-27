
-- Create enums for the publish portal
CREATE TYPE platform_type AS ENUM ('FB', 'IG_FEED', 'IG_REEL');
CREATE TYPE post_status AS ENUM ('QUEUED', 'PUBLISHED', 'ERROR');
CREATE TYPE content_status AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- Generated Content table
CREATE TABLE generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    media_url TEXT,
    status content_status DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Scheduled Posts table
CREATE TABLE scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    publish_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status post_status DEFAULT 'QUEUED',
    published_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    insights_fetched BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Post Metrics table
CREATE TABLE post_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_scheduled_posts_status_publish_at ON scheduled_posts(status, publish_at);
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_generated_content_user_id ON generated_content(user_id);
CREATE INDEX idx_generated_content_status ON generated_content(status);

-- Enable RLS
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for generated_content
CREATE POLICY "Users can view their own generated content" ON generated_content
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated content" ON generated_content
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated content" ON generated_content
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated content" ON generated_content
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for scheduled_posts
CREATE POLICY "Users can view their own scheduled posts" ON scheduled_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled posts" ON scheduled_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled posts" ON scheduled_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled posts" ON scheduled_posts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for post_metrics
CREATE POLICY "Users can view metrics for their posts" ON post_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM scheduled_posts sp 
            WHERE sp.id = post_metrics.scheduled_id 
            AND sp.user_id = auth.uid()
        )
    );

-- Add update trigger for generated_content
CREATE OR REPLACE FUNCTION update_generated_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_generated_content_updated_at
    BEFORE UPDATE ON generated_content
    FOR EACH ROW
    EXECUTE FUNCTION update_generated_content_updated_at();

-- Add update trigger for scheduled_posts
CREATE OR REPLACE FUNCTION update_scheduled_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_posts_updated_at
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_posts_updated_at();
