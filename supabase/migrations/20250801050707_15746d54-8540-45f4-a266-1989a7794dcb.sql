-- Enhanced newsletter ideas function with weekly themes and better prioritization
CREATE OR REPLACE FUNCTION public.fn_get_newsletter_ideas(p_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_location text;
  current_season text;
  current_week integer;
  ideas jsonb := '[]'::jsonb;
  holiday_ideas jsonb := '[]'::jsonb;
  weekly_theme_idea jsonb;
  seasonal_ideas jsonb := '[]'::jsonb;
  general_ideas jsonb := '[]'::jsonb;
BEGIN
  -- Get user location for seasonal content
  SELECT location_info INTO user_location
  FROM public.company_profiles 
  WHERE user_id = p_user_id;
  
  -- Get current week number (ISO week)
  current_week := EXTRACT(WEEK FROM CURRENT_DATE);
  
  -- Determine current season
  current_season := CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (12, 1, 2) THEN 'winter'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
    ELSE 'fall'
  END;
  
  -- Build priority holiday ideas (next 45 days for better planning)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', 'holiday-' || h.id::text,
      'title', h.holiday_name || ' Newsletter',
      'description', 'Create a special newsletter for ' || h.holiday_name || '. ' || COALESCE(h.description, 'Perfect timing for seasonal engagement.'),
      'category', 'holiday',
      'badge', CASE 
        WHEN h.holiday_date <= CURRENT_DATE + INTERVAL '14 days' THEN 'Urgent'
        WHEN h.holiday_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Holiday'
        ELSE 'Plan Ahead'
      END,
      'priority', CASE 
        WHEN h.holiday_date <= CURRENT_DATE + INTERVAL '14 days' THEN 1
        WHEN h.holiday_date <= CURRENT_DATE + INTERVAL '30 days' THEN 2
        ELSE 3
      END,
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', h.holiday_name || ' Special'),
        jsonb_build_object('type', 'image-text', 'title', 'Celebrate ' || h.holiday_name, 'content', COALESCE(h.garden_relevance, 'Make this holiday special with our featured products and tips.')),
        jsonb_build_object('type', 'button', 'buttonText', 'Shop Holiday Collection', 'buttonUrl', '#')
      ),
      'heroQuery', LOWER(REPLACE(h.holiday_name, ' ', ' ')) || ' celebration',
      'estimatedReadTime', '4 min',
      'daysUntil', h.holiday_date - CURRENT_DATE
    ) ORDER BY h.holiday_date
  ) INTO holiday_ideas
  FROM public.holidays h
  WHERE h.holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'
    AND h.is_active = true
  LIMIT 3;
  
  -- Build current week's theme idea
  SELECT jsonb_build_object(
    'id', 'weekly-theme-' || mct.week_number::text,
    'title', mct.title || ' (This Week)',
    'description', 'This week''s featured theme: ' || mct.theme || '. ' || COALESCE(mct.content_ideas, 'Perfect timing for seasonal engagement.'),
    'category', 'weekly',
    'badge', 'This Week',
    'priority', 2,
    'templateBlocks', jsonb_build_array(
      jsonb_build_object('type', 'header', 'title', 'Week ' || mct.week_number || ': ' || mct.title),
      jsonb_build_object('type', 'image-text', 'title', mct.theme, 'content', COALESCE(mct.content_ideas, 'Weekly themed content for your audience.')),
      jsonb_build_object('type', 'text', 'content', 'Focus: ' || COALESCE(mct.seasonal_focus, 'Seasonal gardening activities'))
    ),
    'heroQuery', LOWER(REPLACE(mct.theme, ' ', ' ')) || ' gardening',
    'estimatedReadTime', '5 min',
    'weekNumber', mct.week_number
  ) INTO weekly_theme_idea
  FROM public.master_campaign_templates mct
  WHERE mct.week_number = current_week;
  
  -- Build seasonal idea
  seasonal_ideas := jsonb_build_array(
    jsonb_build_object(
      'id', 'seasonal-' || current_season,
      'title', INITCAP(current_season) || ' Garden Care Guide',
      'description', 'Essential tips and advice for maintaining your garden during ' || current_season || ' season.',
      'category', 'seasonal',
      'badge', 'Seasonal',
      'priority', 3,
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', INITCAP(current_season) || ' Garden Care'),
        jsonb_build_object('type', 'image-text', 'title', 'This Season''s Focus', 'content', 'Important care tips for ' || current_season || ' gardening success.'),
        jsonb_build_object('type', 'text', 'content', 'Follow our expert recommendations to keep your garden thriving.')
      ),
      'heroQuery', current_season || ' garden care tips',
      'estimatedReadTime', '6 min'
    )
  );
  
  -- Build general/evergreen ideas
  general_ideas := jsonb_build_array(
    jsonb_build_object(
      'id', 'monthly-checklist',
      'title', 'Monthly Gardening Checklist',
      'description', 'Your complete guide to monthly garden tasks and maintenance activities.',
      'category', 'general',
      'badge', 'Checklist',
      'priority', 4,
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
      'priority', 4,
      'templateBlocks', jsonb_build_array(
        jsonb_build_object('type', 'header', 'title', 'Featured Products'),
        jsonb_build_object('type', 'image-text', 'title', 'Product of the Month', 'content', 'Discover our carefully selected featured items.'),
        jsonb_build_object('type', 'button', 'buttonText', 'Shop Now', 'buttonUrl', '#')
      ),
      'heroQuery', 'premium products showcase',
      'estimatedReadTime', '3 min'
    )
  );
  
  -- Combine all ideas with priority ordering
  ideas := COALESCE(holiday_ideas, '[]'::jsonb);
  
  -- Add weekly theme if available
  IF weekly_theme_idea IS NOT NULL THEN
    ideas := ideas || jsonb_build_array(weekly_theme_idea);
  END IF;
  
  -- Add seasonal and general ideas
  ideas := ideas || seasonal_ideas || general_ideas;
  
  RETURN ideas;
END;
$function$