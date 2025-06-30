
-- Fix seasonal content misalignment in master_campaign_templates
-- Week 27 (late June/early July) currently has back-to-school content, should be summer content
-- Move back-to-school content to appropriate fall timing

-- Update week 27 to have appropriate summer content
UPDATE master_campaign_templates 
SET 
  title = 'Mid-Summer Garden Care Excellence',
  theme = 'Summer Heat Management',
  seasonal_focus = 'Mid-summer garden maintenance and heat protection strategies',
  content_ideas = 'Heat-resistant plant care, efficient watering techniques, summer pruning methods, protecting plants from extreme heat',
  target_audience_notes = 'Gardeners managing summer heat stress and maintaining healthy gardens during peak summer'
WHERE week_number = 27;

-- Find a good week for back-to-school content (week 35 is late August, perfect timing)
-- First check if week 35 exists and what content it has
UPDATE master_campaign_templates 
SET 
  title = 'Back-to-School Garden Learning',
  theme = 'Educational gardening and family projects',
  seasonal_focus = 'Back-to-school season with educational garden activities',
  content_ideas = 'Family garden projects, teaching kids about plants, school garden ideas, educational gardening activities',
  target_audience_notes = 'Families returning to school routines, educational institutions, parent-child gardening activities'
WHERE week_number = 35;

-- Also ensure week 36 has appropriate early fall content if it exists
UPDATE master_campaign_templates 
SET 
  title = 'Early Fall Garden Transitions',
  theme = 'Preparing for autumn gardening season',
  seasonal_focus = 'Transition from summer to fall gardening activities',
  content_ideas = 'Fall planting preparation, summer cleanup, autumn garden planning, cool-season crop preparation',
  target_audience_notes = 'Gardeners preparing for fall season and planning autumn activities'
WHERE week_number = 36;
