-- ============================================
-- AI Assistant Chat Persistence System
-- ============================================

-- Table 1: ai_assistant_sessions
-- Stores individual chat sessions/conversations
CREATE TABLE ai_assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership & Multi-tenancy
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Session Context (what block/campaign is being edited)
  context_type TEXT, -- 'email_block', 'campaign_header', 'general'
  context_id UUID, -- block_id, campaign_id, etc.
  channel TEXT, -- 'newsletter', 'instagram', 'facebook'
  
  -- Auto-generated metadata
  title TEXT, -- Auto-generated from first prompt (max 50 chars)
  message_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_tenant ON ai_assistant_sessions(user_id, tenant_id);
CREATE INDEX idx_sessions_context ON ai_assistant_sessions(context_type, context_id);
CREATE INDEX idx_sessions_last_activity ON ai_assistant_sessions(last_activity_at DESC);

-- RLS Policies for ai_assistant_sessions
ALTER TABLE ai_assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view sessions in their tenant"
  ON ai_assistant_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.tenant_id = ai_assistant_sessions.tenant_id 
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users create sessions in their tenant"
  ON ai_assistant_sessions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = ai_assistant_sessions.tenant_id AND u.id = auth.uid())
  );

CREATE POLICY "Users update their own sessions"
  ON ai_assistant_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete their own sessions"
  ON ai_assistant_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================

-- Table 2: ai_assistant_messages
-- Stores individual messages within chat sessions
CREATE TABLE ai_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship
  session_id UUID NOT NULL REFERENCES ai_assistant_sessions(id) ON DELETE CASCADE,
  
  -- Message Data
  message_type TEXT NOT NULL, -- 'user_prompt', 'thinking_text', 'assistant_response', 'images'
  content TEXT NOT NULL,
  sequence_number INTEGER NOT NULL, -- For ordering (1, 2, 3...)
  
  -- Metadata (thinking duration, enhanced prompt, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint for sequence within session
  UNIQUE(session_id, sequence_number)
);

-- Indexes for pagination queries
CREATE INDEX idx_messages_session_sequence ON ai_assistant_messages(session_id, sequence_number DESC);

-- RLS Policies for ai_assistant_messages
ALTER TABLE ai_assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view messages in their tenant sessions"
  ON ai_assistant_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_assistant_sessions s
      JOIN users u ON u.tenant_id = s.tenant_id
      WHERE s.id = ai_assistant_messages.session_id 
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users create messages in their sessions"
  ON ai_assistant_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_assistant_sessions s
      WHERE s.id = ai_assistant_messages.session_id 
      AND s.user_id = auth.uid()
    )
  );

-- ============================================

-- Table 3: ai_assistant_generated_images
-- Links generated images to messages and references central gallery
CREATE TABLE ai_assistant_generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  session_id UUID NOT NULL REFERENCES ai_assistant_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES ai_assistant_messages(id) ON DELETE CASCADE,
  global_image_id UUID NOT NULL REFERENCES global_image_gallery(id) ON DELETE CASCADE,
  
  -- Generation Context
  user_prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  generation_order INTEGER NOT NULL CHECK (generation_order BETWEEN 1 AND 3),
  
  -- Selection Tracking
  is_selected BOOLEAN DEFAULT false,
  selected_at TIMESTAMPTZ,
  
  -- Usage Tracking
  used_in_context TEXT, -- 'email_block', 'campaign_header'
  used_in_id UUID, -- block_id or campaign_id where image was used
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_gen_images_session ON ai_assistant_generated_images(session_id);
CREATE INDEX idx_gen_images_message ON ai_assistant_generated_images(message_id);
CREATE INDEX idx_gen_images_global ON ai_assistant_generated_images(global_image_id);

-- RLS Policies for ai_assistant_generated_images
ALTER TABLE ai_assistant_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view images in their tenant sessions"
  ON ai_assistant_generated_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_assistant_sessions s
      JOIN users u ON u.tenant_id = s.tenant_id
      WHERE s.id = ai_assistant_generated_images.session_id 
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Service role manages images"
  ON ai_assistant_generated_images FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users create images in their sessions"
  ON ai_assistant_generated_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_assistant_sessions s
      WHERE s.id = ai_assistant_generated_images.session_id 
      AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- Database Functions & Triggers
-- ============================================

-- Function: Auto-increment message count and update timestamps
CREATE OR REPLACE FUNCTION update_session_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_assistant_sessions
  SET 
    message_count = message_count + 1,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_counters
  AFTER INSERT ON ai_assistant_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_on_message_insert();

-- ============================================

-- Function: Auto-generate session title from first user prompt
CREATE OR REPLACE FUNCTION auto_generate_session_title()
RETURNS TRIGGER AS $$
DECLARE
  session_title TEXT;
BEGIN
  IF NEW.message_type = 'user_prompt' THEN
    SELECT title INTO session_title 
    FROM ai_assistant_sessions 
    WHERE id = NEW.session_id;
    
    -- Only set title if it's null (first prompt)
    IF session_title IS NULL THEN
      UPDATE ai_assistant_sessions
      SET title = LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
      WHERE id = NEW.session_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_title
  AFTER INSERT ON ai_assistant_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_session_title();

-- ============================================

-- Function: Update image count when images are generated
CREATE OR REPLACE FUNCTION update_session_image_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_assistant_sessions
  SET 
    image_count = image_count + 1,
    updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_image_count
  AFTER INSERT ON ai_assistant_generated_images
  FOR EACH ROW
  EXECUTE FUNCTION update_session_image_count();