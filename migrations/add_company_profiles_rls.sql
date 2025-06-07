
-- Enable RLS on company_profiles table
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own company profile
CREATE POLICY "Users can view own company profile" ON company_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert their own company profile
CREATE POLICY "Users can insert own company profile" ON company_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own company profile
CREATE POLICY "Users can update own company profile" ON company_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy to allow users to delete their own company profile
CREATE POLICY "Users can delete own company profile" ON company_profiles
  FOR DELETE USING (auth.uid() = user_id);
