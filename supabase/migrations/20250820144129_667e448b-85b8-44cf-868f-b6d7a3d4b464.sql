-- Update existing campaigns to match the new master template themes and data
UPDATE campaigns 
SET 
  title = mct.title,
  theme = mct.theme,
  description = mct.content_ideas,
  prompt = CASE 
    WHEN mct.prompt IS NOT NULL THEN mct.prompt
    ELSE 'Create engaging content about ' || mct.theme || '. Focus on ' || mct.seasonal_focus || '. ' || mct.content_ideas
  END
FROM master_campaign_templates mct 
WHERE campaigns.week_number = mct.week_number 
  AND campaigns.user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac';