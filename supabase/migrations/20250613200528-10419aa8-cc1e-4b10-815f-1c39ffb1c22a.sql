
-- Add token tracking fields to company profiles
ALTER TABLE public.company_profiles 
ADD COLUMN tokens_balance INTEGER DEFAULT 100,
ADD COLUMN tokens_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '1 month');

-- Create token usage tracking table
CREATE TABLE public.token_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  action_type TEXT NOT NULL, -- 'generation', 'refill', 'overage_charge'
  tokens_consumed INTEGER NOT NULL,
  tokens_remaining INTEGER NOT NULL,
  content_type TEXT, -- 'facebook', 'instagram', 'email', etc.
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS on token usage
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for token usage
CREATE POLICY "Users can view their own token usage" 
  ON public.token_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own token usage" 
  ON public.token_usage 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Update subscriptions table to support the Growth plan
ALTER TABLE public.subscriptions 
ADD COLUMN stripe_subscription_item_id TEXT,
ADD COLUMN base_token_allowance INTEGER DEFAULT 100,
ADD COLUMN overage_token_price DECIMAL(4,2) DEFAULT 0.25;

-- Create function to spend tokens
CREATE OR REPLACE FUNCTION public.spend_tokens(
  p_user_id UUID,
  p_tokens INTEGER,
  p_action_type TEXT DEFAULT 'generation',
  p_content_type TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INTEGER;
  profile_id UUID;
BEGIN
  -- Get user's company profile and current token balance
  SELECT id, tokens_balance INTO profile_id, current_balance
  FROM public.company_profiles 
  WHERE user_id = p_user_id;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No company profile found for user';
  END IF;
  
  -- Check if user has enough tokens (allow negative for overage)
  IF current_balance < p_tokens AND current_balance >= 0 THEN
    -- User will go into overage, but allow it
    NULL;
  END IF;
  
  -- Deduct tokens
  UPDATE public.company_profiles 
  SET tokens_balance = tokens_balance - p_tokens
  WHERE id = profile_id;
  
  -- Log the usage
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining,
    content_type,
    campaign_id
  ) VALUES (
    p_user_id,
    p_action_type,
    p_tokens,
    current_balance - p_tokens,
    p_content_type,
    p_campaign_id
  );
  
  RETURN TRUE;
END;
$$;

-- Create function to refill tokens (monthly reset)
CREATE OR REPLACE FUNCTION public.refill_tokens(
  p_user_id UUID,
  p_tokens INTEGER DEFAULT 100
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_id UUID;
BEGIN
  -- Get user's company profile
  SELECT id INTO profile_id
  FROM public.company_profiles 
  WHERE user_id = p_user_id;
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No company profile found for user';
  END IF;
  
  -- Reset tokens and update reset date
  UPDATE public.company_profiles 
  SET 
    tokens_balance = p_tokens,
    tokens_reset_at = now() + INTERVAL '1 month'
  WHERE id = profile_id;
  
  -- Log the refill
  INSERT INTO public.token_usage (
    user_id, 
    action_type, 
    tokens_consumed, 
    tokens_remaining
  ) VALUES (
    p_user_id,
    'refill',
    p_tokens,
    p_tokens
  );
  
  RETURN TRUE;
END;
$$;

-- Create function to get token balance
CREATE OR REPLACE FUNCTION public.get_token_balance(p_user_id UUID)
RETURNS TABLE(
  tokens_balance INTEGER,
  tokens_reset_at TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    cp.tokens_balance,
    cp.tokens_reset_at,
    s.plan = 'free_trial' as is_trial
  FROM public.company_profiles cp
  LEFT JOIN public.subscriptions s ON s.user_id = cp.user_id
  WHERE cp.user_id = p_user_id;
$$;
