-- Create onboarding_responses table for storing user onboarding data
CREATE TABLE public.onboarding_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  website_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own data
CREATE POLICY "Users can view their own onboarding responses" 
ON public.onboarding_responses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding responses" 
ON public.onboarding_responses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding responses" 
ON public.onboarding_responses 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_onboarding_responses_updated_at
BEFORE UPDATE ON public.onboarding_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();