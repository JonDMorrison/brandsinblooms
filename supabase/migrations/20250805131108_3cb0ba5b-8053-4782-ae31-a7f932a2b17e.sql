-- Create website_waitlist table to store waitlist signups
CREATE TABLE public.website_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.website_waitlist ENABLE ROW LEVEL SECURITY;

-- Create policies for website_waitlist
CREATE POLICY "Anyone can insert waitlist entries" 
ON public.website_waitlist 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own waitlist entries" 
ON public.website_waitlist 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_website_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_website_waitlist_updated_at
BEFORE UPDATE ON public.website_waitlist
FOR EACH ROW
EXECUTE FUNCTION public.update_website_waitlist_updated_at();

-- Add unique constraint on email to prevent duplicates
ALTER TABLE public.website_waitlist 
ADD CONSTRAINT unique_email UNIQUE (email);