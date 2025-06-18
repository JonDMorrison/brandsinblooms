
-- Create holiday templates table to store base holiday information
CREATE TABLE public.holiday_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Day',
  description TEXT,
  garden_relevance_template TEXT,
  calculation_rule JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for holiday templates (admin only for now)
ALTER TABLE public.holiday_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for reading holiday templates (public read access)
CREATE POLICY "Anyone can view active holiday templates" 
  ON public.holiday_templates 
  FOR SELECT 
  USING (is_active = true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_holiday_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_holiday_templates_updated_at
  BEFORE UPDATE ON public.holiday_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_holiday_templates_updated_at();

-- Insert base holiday templates with calculation rules
INSERT INTO public.holiday_templates (holiday_name, category, description, garden_relevance_template, calculation_rule) VALUES
-- Fixed date holidays
('New Year''s Day', 'Day', 'Start of the new year', 'New year, new garden resolutions! Perfect time to promote planning tools, garden journals, and early seed starting supplies for {year}', '{"type": "fixed", "month": 1, "day": 1}'),
('Valentine''s Day', 'Day', 'Day of love and romance', 'Promote romantic flowering plants like roses, flowering bulbs for spring {year}, and gift plants for loved ones', '{"type": "fixed", "month": 2, "day": 14}'),
('St. Patrick''s Day', 'Day', 'Irish cultural celebration', 'Promote green plants, shamrocks, Irish-themed planters, and green foliage plants for festive decorating in {year}', '{"type": "fixed", "month": 3, "day": 17}'),
('Earth Day', 'Day', 'Environmental awareness day', 'Promote eco-friendly gardening practices, native plants, composting supplies, and sustainable gardening methods for Earth Day {year}', '{"type": "fixed", "month": 4, "day": 22}'),
('Christmas', 'Day', 'Christian holiday celebration', 'Promote Christmas trees, holiday plants like poinsettias, winter decorations, and festive garden displays for Christmas {year}', '{"type": "fixed", "month": 12, "day": 25}'),
('Independence Day', 'Day', 'American independence celebration', 'Promote red, white, and blue flower combinations, patriotic garden displays, and summer entertaining plants for July 4th {year}', '{"type": "fixed", "month": 7, "day": 4}'),
('Halloween', 'Day', 'Traditional autumn holiday', 'Promote pumpkins, gourds, fall decorations, autumn flowers, and spooky garden displays for Halloween {year}', '{"type": "fixed", "month": 10, "day": 31}'),

-- Relative date holidays (calculated)
('Mother''s Day', 'Day', 'Day honoring mothers', 'Major flower holiday! Promote beautiful flowering plants, hanging baskets, planters, and garden gifts for mom on Mother''s Day {year}', '{"type": "nth_weekday", "month": 5, "weekday": 0, "occurrence": 2}'),
('Father''s Day', 'Day', 'Day honoring fathers', 'Promote practical garden tools, vegetable gardening supplies, outdoor plants, and garden projects for dad on Father''s Day {year}', '{"type": "nth_weekday", "month": 6, "weekday": 0, "occurrence": 3}'),
('Thanksgiving', 'Day', 'American harvest celebration', 'Promote harvest decorations, fall centerpieces, gratitude gardens, and indoor plants for cozy autumn atmosphere during Thanksgiving {year}', '{"type": "nth_weekday", "month": 11, "weekday": 4, "occurrence": 4}'),
('Memorial Day', 'Day', 'Day honoring fallen military personnel', 'Long weekend marking unofficial start of summer {year}. Promote summer annuals, vegetable starts, and outdoor living plants', '{"type": "last_weekday", "month": 5, "weekday": 1}'),
('Labor Day', 'Day', 'Day honoring American workers', 'End of summer transition in {year} - promote fall planting, cool season crops, and autumn garden preparation', '{"type": "nth_weekday", "month": 9, "weekday": 1, "occurrence": 1}'),

-- Seasonal dates
('Spring Equinox', 'Day', 'First day of spring', 'Major gardening season kickoff for {year}! Promote spring planting supplies, seeds, soil amendments, and garden tools', '{"type": "spring_equinox"}'),
('Summer Solstice', 'Day', 'Longest day of the year', 'Celebrate peak growing season {year} with sun-loving plants, summer flowering displays, and outdoor garden events', '{"type": "summer_solstice"}'),
('Fall Equinox', 'Day', 'First day of fall', 'Fall gardening season begins in {year}! Promote fall planting, autumn decorations, and winter garden preparation', '{"type": "fall_equinox"}'),
('Winter Solstice', 'Day', 'Shortest day of the year', 'Promote winter garden interest, evergreen plants, holiday decorations, and indoor gardening for winter {year}', '{"type": "winter_solstice"}'),

-- Monthly observances
('National Indoor Plant Month', 'Month', 'January focus on houseplants', 'Dedicate January {year} to promoting houseplants, indoor gardening supplies, plant care education, and winter indoor growing', '{"type": "fixed", "month": 1, "day": 1}'),
('National Garden Month', 'Month', 'April celebration of gardening', 'Peak promotion month for all gardening supplies, tools, plants, and educational workshops during April {year}', '{"type": "fixed", "month": 4, "day": 1}'),
('National Rose Month', 'Month', 'June celebration of roses', 'Focus on rose sales, rose care products, rose companion plants, and rose gardening education during June {year}', '{"type": "fixed", "month": 6, "day": 1}');

-- Create holiday generation log table
CREATE TABLE public.holiday_generation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  holidays_generated INTEGER NOT NULL DEFAULT 0,
  holidays_deactivated INTEGER NOT NULL DEFAULT 0,
  generation_type TEXT NOT NULL DEFAULT 'automatic',
  triggered_by UUID REFERENCES auth.users,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS for generation logs
ALTER TABLE public.holiday_generation_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for reading generation logs (admin access)
CREATE POLICY "Admins can view holiday generation logs" 
  ON public.holiday_generation_logs 
  FOR SELECT 
  USING (true);
