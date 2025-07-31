-- Create function to get newsletter ideas from various sources
CREATE OR REPLACE FUNCTION public.fn_get_newsletter_ideas(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id text,
  title text,
  description text,
  category text,
  badge text,
  template_blocks jsonb,
  hero_query text,
  estimated_read_time text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_location text;
  current_season text;
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
  
  RETURN QUERY
  -- Holiday ideas (upcoming holidays within 30 days)
  SELECT 
    'holiday-' || h.id::text as id,
    h.holiday_name || ' Newsletter' as title,
    'Create a special newsletter for ' || h.holiday_name || '. ' || COALESCE(h.description, 'Perfect timing for seasonal engagement.') as description,
    'holiday'::text as category,
    'Holiday'::text as badge,
    jsonb_build_array(
      jsonb_build_object('type', 'header', 'title', h.holiday_name || ' Special'),
      jsonb_build_object('type', 'image-text', 'title', 'Celebrate ' || h.holiday_name, 'content', COALESCE(h.garden_relevance, 'Make this holiday special with our featured products and tips.')),
      jsonb_build_object('type', 'button', 'buttonText', 'Shop Holiday Collection', 'buttonUrl', '#')
    ) as template_blocks,
    LOWER(REPLACE(h.holiday_name, ' ', ' ')) || ' celebration' as hero_query,
    '4 min'::text as estimated_read_time
  FROM public.holidays h
  WHERE h.holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND h.is_active = true
  ORDER BY h.holiday_date
  LIMIT 3
  
  UNION ALL
  
  -- Seasonal content ideas
  SELECT 
    'seasonal-' || current_season as id,
    INITCAP(current_season) || ' Garden Care Guide' as title,
    'Essential tips and advice for maintaining your garden during ' || current_season || ' season.' as description,
    'seasonal'::text as category,
    'Seasonal'::text as badge,
    jsonb_build_array(
      jsonb_build_object('type', 'header', 'title', INITCAP(current_season) || ' Garden Care'),
      jsonb_build_object('type', 'image-text', 'title', 'This Season''s Focus', 'content', 'Important care tips for ' || current_season || ' gardening success.'),
      jsonb_build_object('type', 'text', 'content', 'Follow our expert recommendations to keep your garden thriving.')
    ) as template_blocks,
    current_season || ' garden care tips' as hero_query,
    '6 min'::text as estimated_read_time
  
  UNION ALL
  
  -- General business ideas
  SELECT 
    'monthly-checklist' as id,
    'Monthly Gardening Checklist' as title,
    'Your complete guide to monthly garden tasks and maintenance activities.' as description,
    'general'::text as category,
    'Checklist'::text as badge,
    jsonb_build_array(
      jsonb_build_object('type', 'header', 'title', 'Monthly Garden Checklist'),
      jsonb_build_object('type', 'text', 'content', 'Stay on top of your garden with these essential monthly tasks.'),
      jsonb_build_object('type', 'image-text', 'title', 'This Month''s Priority Tasks', 'content', 'Focus on these key activities for optimal garden health.')
    ) as template_blocks,
    'monthly garden checklist tools' as hero_query,
    '7 min'::text as estimated_read_time
    
  UNION ALL
  
  SELECT 
    'product-spotlight' as id,
    'Product Spotlight Newsletter' as title,
    'Feature your best products and new arrivals with compelling descriptions.' as description,
    'product'::text as category,
    'Product'::text as badge,
    jsonb_build_array(
      jsonb_build_object('type', 'header', 'title', 'Featured Products'),
      jsonb_build_object('type', 'image-text', 'title', 'Product of the Month', 'content', 'Discover our carefully selected featured items.'),
      jsonb_build_object('type', 'button', 'buttonText', 'Shop Now', 'buttonUrl', '#')
    ) as template_blocks,
    'premium products showcase' as hero_query,
    '3 min'::text as estimated_read_time;
END;
$$;