
-- Create the holidays table for storing seasonal holidays and observances
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'seasonal',
  is_active BOOLEAN DEFAULT true,
  garden_relevance TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add holiday_id column to content_tasks table to link holiday content
ALTER TABLE public.content_tasks 
ADD COLUMN holiday_id UUID REFERENCES public.holidays(id);

-- Add user_id column to content_tasks if it doesn't exist (for RLS)
ALTER TABLE public.content_tasks 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Enable RLS on holidays table
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Create policy for holidays (read-only for all authenticated users)
CREATE POLICY "All authenticated users can view holidays" 
  ON public.holidays 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Update content_tasks RLS policies to include holiday_id filtering
DROP POLICY IF EXISTS "Users can view their own content tasks" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can create their own content tasks" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can update their own content tasks" ON public.content_tasks;
DROP POLICY IF EXISTS "Users can delete their own content tasks" ON public.content_tasks;

-- Enable RLS on content_tasks if not already enabled
ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for content_tasks
CREATE POLICY "Users can view their own content tasks" 
  ON public.content_tasks 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own content tasks" 
  ON public.content_tasks 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content tasks" 
  ON public.content_tasks 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content tasks" 
  ON public.content_tasks 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX idx_holidays_date ON public.holidays(holiday_date);
CREATE INDEX idx_holidays_active ON public.holidays(is_active) WHERE is_active = true;
CREATE INDEX idx_content_tasks_holiday ON public.content_tasks(holiday_id);

-- Insert sample gardening-related holidays for testing
INSERT INTO public.holidays (holiday_name, holiday_date, description, category, garden_relevance) VALUES
('Earth Day', '2024-04-22', 'Annual event to demonstrate support for environmental protection', 'environmental', 'Perfect time to promote eco-friendly gardening practices, composting, and sustainable plant choices'),
('Mother''s Day', '2024-05-12', 'Day honoring mothers and motherhood', 'family', 'Ideal for promoting beautiful flowering plants, garden gifts, and creating memorable garden experiences for mom'),
('Memorial Day Weekend', '2024-05-27', 'Federal holiday honoring military personnel who died in service', 'patriotic', 'Traditional start of gardening season, perfect for promoting summer vegetables, patriotic plant combinations'),
('Summer Solstice', '2024-06-21', 'Longest day of the year in Northern Hemisphere', 'seasonal', 'Celebrate peak growing season with sun-loving plants, garden parties, and outdoor living spaces'),
('Independence Day', '2024-07-04', 'Celebration of American independence', 'patriotic', 'Promote red, white, and blue flower combinations, summer garden parties, and outdoor entertaining'),
('Labor Day Weekend', '2024-09-02', 'Federal holiday honoring American workers', 'seasonal', 'End of summer gardening season, time for fall planting and garden cleanup'),
('Halloween', '2024-10-31', 'Traditional holiday with costumes and decorations', 'seasonal', 'Perfect for promoting pumpkins, fall decorations, autumn flowers, and spooky garden displays'),
('Thanksgiving', '2024-11-28', 'National day of giving thanks', 'family', 'Promote harvest decorations, fall centerpieces, and indoor plants for cozy autumn atmosphere');

-- Update the trigger for updated_at on holidays
CREATE OR REPLACE FUNCTION update_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_holidays_updated_at_trigger
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_holidays_updated_at();
