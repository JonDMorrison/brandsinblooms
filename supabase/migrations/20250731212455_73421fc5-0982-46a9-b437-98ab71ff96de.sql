-- Create function to get newsletter ideas from various sources
CREATE OR REPLACE FUNCTION public.fn_get_newsletter_ideas(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_location text;
  current_season text;
  ideas jsonb := '[]'::jsonb;
  holiday_ideas jsonb := '[]'::jsonb;
  seasonal_ideas jsonb := '[]'::jsonb;
  general_ideas jsonb := '[]'::jsonb;
BEGIN
  -- Get user location for seasonal content
  SELECT location_info INTO user_location
  FROM public.company_profiles 
  WHERE user_id = p_user_id;
  
  -- Determine current season (simplified)
  current_season := CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (12, 1, 2) THEN 'winter'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
    ELSE 'fall'
  END;
  
  -- Build holiday ideas
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', 'holiday-' || h.id::text,
      'title', h.holiday_name || ' Newsletter',
      'description', 'Create a special newsletter for ' || h.holiday_name || '. ' || COALESCE(h.description, 'Perfect timing for seasonal engagement.'),
      'category', 'holiday',
      'badge', 'Holiday',
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', h.holiday_name || ' Special'),
        jsonb_build_object('type', 'image-text', 'title', 'Celebrate ' || h.holiday_name, 'content', COALESCE(h.garden_relevance, 'Make this holiday special with our featured products and tips.')),
        jsonb_build_object('type', 'button', 'buttonText', 'Shop Holiday Collection', 'buttonUrl', '#')
      ),
      'heroQuery', LOWER(REPLACE(h.holiday_name, ' ', ' ')) || ' celebration',
      'estimatedReadTime', '4 min'
    )
  ) INTO holiday_ideas
  FROM public.holidays h
  WHERE h.holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND h.is_active = true
  ORDER BY h.holiday_date
  LIMIT 2;
  
  -- Build seasonal idea
  seasonal_ideas := jsonb_build_array(
    jsonb_build_object(
      'id', 'seasonal-' || current_season,
      'title', INITCAP(current_season) || ' Garden Care Guide',
      'description', 'Essential tips and advice for maintaining your garden during ' || current_season || ' season.',
      'category', 'seasonal',
      'badge', 'Seasonal',
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', INITCAP(current_season) || ' Garden Care'),
        jsonb_build_object('type', 'image-text', 'title', 'This Season''s Focus', 'content', 'Important care tips for ' || current_season || ' gardening success.'),
        jsonb_build_object('type', 'text', 'content', 'Follow our expert recommendations to keep your garden thriving.')
      ),
      'heroQuery', current_season || ' garden care tips',
      'estimatedReadTime', '6 min'
    )
  );
  
  -- Build general ideas
  general_ideas := jsonb_build_array(
    jsonb_build_object(
      'id', 'monthly-checklist',
      'title', 'Monthly Gardening Checklist',
      'description', 'Your complete guide to monthly garden tasks and maintenance activities.',
      'category', 'general',
      'badge', 'Checklist',
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', 'Monthly Garden Checklist'),
        jsonb_build_object('type', 'text', 'content', 'Stay on top of your garden with these essential monthly tasks.'),
        jsonb_build_object('type', 'image-text', 'title', 'This Month''s Priority Tasks', 'content', 'Focus on these key activities for optimal garden health.')
      ),
      'heroQuery', 'monthly garden checklist tools',
      'estimatedReadTime', '7 min'
    ),
    jsonb_build_object(
      'id', 'product-spotlight',
      'title', 'Product Spotlight Newsletter',
      'description', 'Feature your best products and new arrivals with compelling descriptions.',
      'category', 'product',
      'badge', 'Product',
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', 'Featured Products'),
        jsonb_build_object('type', 'image-text', 'title', 'Product of the Month', 'content', 'Discover our carefully selected featured items.'),
        jsonb_build_object('type', 'button', 'buttonText', 'Shop Now', 'buttonUrl', '#')
      ),
      'heroQuery', 'premium products showcase',
      'estimatedReadTime', '3 min'
    )
  );
  
  -- Combine all ideas
  ideas := COALESCE(holiday_ideas, '[]'::jsonb) || seasonal_ideas || general_ideas;
  
  RETURN ideas;
END;
$$;