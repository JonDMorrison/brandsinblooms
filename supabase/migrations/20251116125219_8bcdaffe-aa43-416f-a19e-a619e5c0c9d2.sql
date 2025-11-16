-- Create reported_problems table
CREATE TABLE IF NOT EXISTS reported_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  
  -- Problem details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Auto-captured metadata
  captured_url TEXT NOT NULL,
  user_agent TEXT,
  viewport_size TEXT,
  browser_info JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  
  -- Admin fields
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  CONSTRAINT description_length CHECK (char_length(description) >= 10),
  CONSTRAINT valid_status CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Create reported_problem_attachments table
CREATE TABLE IF NOT EXISTS reported_problem_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES reported_problems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'problem-attachments',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for reported_problems
CREATE INDEX IF NOT EXISTS idx_reported_problems_tenant ON reported_problems(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reported_problems_user ON reported_problems(user_id);
CREATE INDEX IF NOT EXISTS idx_reported_problems_status ON reported_problems(status);
CREATE INDEX IF NOT EXISTS idx_reported_problems_created ON reported_problems(created_at DESC);

-- Create indexes for reported_problem_attachments
CREATE INDEX IF NOT EXISTS idx_problem_attachments_problem ON reported_problem_attachments(problem_id);

-- Enable RLS
ALTER TABLE reported_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_problem_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reported_problems

-- Users can view their own reported problems
CREATE POLICY "Users can view own problems"
  ON reported_problems FOR SELECT
  USING (user_id = auth.uid());

-- Super admins can view all problems
CREATE POLICY "Super admins can view all problems"
  ON reported_problems FOR SELECT
  USING (is_master_admin(auth.uid()));

-- Users can insert their own problems
CREATE POLICY "Users can create problems"
  ON reported_problems FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.tenant_id = reported_problems.tenant_id)
  );

-- Super admins can update any problem
CREATE POLICY "Super admins can update problems"
  ON reported_problems FOR UPDATE
  USING (is_master_admin(auth.uid()));

-- Super admins can delete problems
CREATE POLICY "Super admins can delete problems"
  ON reported_problems FOR DELETE
  USING (is_master_admin(auth.uid()));

-- RLS Policies for reported_problem_attachments

-- Users can view attachments for their problems
CREATE POLICY "Users can view own problem attachments"
  ON reported_problem_attachments FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM reported_problems rp WHERE rp.id = problem_id AND rp.user_id = auth.uid())
  );

-- Super admins can view all attachments
CREATE POLICY "Super admins can view all attachments"
  ON reported_problem_attachments FOR SELECT
  USING (is_master_admin(auth.uid()));

-- Users can insert attachments for their problems
CREATE POLICY "Users can upload attachments"
  ON reported_problem_attachments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM reported_problems rp WHERE rp.id = problem_id AND rp.user_id = auth.uid())
  );

-- Create storage bucket for problem attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'problem-attachments',
  'problem-attachments',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for problem-attachments bucket
CREATE POLICY "Users can upload problem attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'problem-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own problem attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'problem-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Super admins can view all problem attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'problem-attachments' AND
    is_master_admin(auth.uid())
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_reported_problems_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reported_problems_updated_at
  BEFORE UPDATE ON reported_problems
  FOR EACH ROW
  EXECUTE FUNCTION update_reported_problems_updated_at();