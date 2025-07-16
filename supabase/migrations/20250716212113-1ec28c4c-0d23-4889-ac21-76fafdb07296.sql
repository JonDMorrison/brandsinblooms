-- Create the persona campaign templates table
CREATE TABLE crm_persona_campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  campaign_type VARCHAR CHECK (campaign_type IN ('email', 'sms')),
  description TEXT,
  season VARCHAR,
  tags TEXT[],
  ai_prompt_context TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE crm_persona_campaign_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing campaign templates
CREATE POLICY "Authenticated users can view campaign templates"
ON crm_persona_campaign_templates
FOR SELECT
TO authenticated
USING (true);

-- Create policy for managing campaign templates (admin only for now)
CREATE POLICY "System can manage campaign templates"
ON crm_persona_campaign_templates
FOR ALL
TO authenticated
USING (true);

-- Insert sample campaign templates for the main personas
INSERT INTO crm_persona_campaign_templates (persona_id, title, campaign_type, description, season, tags, ai_prompt_context) 
VALUES 
-- Plant-Killer Pam templates
((SELECT id FROM personas WHERE name = 'Plant-Killer Pam'), 'Low-Water Gardening Made Easy', 'email', 'Introduce drought-tolerant plants perfect for beginners who worry about overwatering', 'summer', '{"beginner", "low-maintenance", "drought-tolerant"}', 'Write an encouraging email about low-water plants perfect for beginner gardeners. Focus on building confidence and emphasizing how these plants are nearly impossible to kill. Include 2-3 specific plant recommendations like succulents or snake plants.'),

((SELECT id FROM personas WHERE name = 'Plant-Killer Pam'), 'Your First Houseplant Success Story', 'email', 'Build confidence with foolproof houseplant recommendations and care tips', 'all', '{"houseplants", "beginner", "confidence"}', 'Write a supportive email helping new plant parents choose their first houseplant. Emphasize that everyone can be successful with the right plant choices. Recommend 3 nearly-indestructible plants with simple care instructions.'),

((SELECT id FROM personas WHERE name = 'Plant-Killer Pam'), 'Oops! Plant Emergency Rescue Guide', 'sms', 'Quick tips for common plant problems with reassuring tone', 'all', '{"plant-care", "troubleshooting", "encouragement"}', 'Write a short, encouraging SMS about common plant problems and simple solutions. Keep tone supportive and reassuring - remind them that plant problems are normal and fixable.'),

-- Pollinator Paula templates  
((SELECT id FROM personas WHERE name = 'Pollinator Paula'), 'Pollinator Paradise: Spring Planting Guide', 'email', 'Encourage planting bee and butterfly-friendly perennials this spring', 'spring', '{"pollinators", "native-plants", "spring-planting"}', 'Write an inspiring email about creating a pollinator paradise. Focus on the environmental impact and include 3-4 bee and butterfly-friendly plants perfect for spring planting. Use warm, purpose-driven language.'),

((SELECT id FROM personas WHERE name = 'Pollinator Paula'), 'Save the Bees: Native Plant Collection', 'email', 'Highlight native plants that support local bee populations', 'all', '{"native-plants", "bees", "conservation"}', 'Write a passionate email about supporting local bee populations through native plant choices. Include the ecological benefits and recommend native plants specific to supporting bees. Use empowering, conservation-focused language.'),

((SELECT id FROM personas WHERE name = 'Pollinator Paula'), 'Butterfly Garden Workshop Alert', 'sms', 'Quick notification about butterfly garden events or plants', 'spring', '{"butterflies", "workshop", "events"}', 'Write an enthusiastic SMS about a butterfly garden workshop or new butterfly-attracting plants. Keep it brief but capture the excitement of supporting butterflies.'),

-- Curb Appeal Ashley templates
((SELECT id FROM personas WHERE name = 'Curb Appeal Ashley'), 'Instagram-Worthy Front Yard Makeover', 'email', 'Showcase trending plants and design ideas for stunning curb appeal', 'spring', '{"curb-appeal", "trending", "design"}', 'Write a stylish email about creating an Instagram-worthy front yard. Focus on current design trends, seasonal color combinations, and plants that photograph beautifully. Use confident, trend-aware language.'),

((SELECT id FROM personas WHERE name = 'Curb Appeal Ashley'), 'Fall Color Explosion: Seasonal Refresh', 'email', 'Promote fall plants and decorations for seasonal curb appeal updates', 'fall', '{"fall-color", "seasonal", "decorating"}', 'Write an exciting email about refreshing curb appeal for fall. Focus on autumn colors, seasonal plants like mums and ornamental kale, and decorative elements that create stunning fall displays.'),

((SELECT id FROM personas WHERE name = 'Curb Appeal Ashley'), 'Your Neighbors Will Be Jealous', 'sms', 'Quick promotion of show-stopping plants or seasonal displays', 'all', '{"standout", "impressive", "neighbors"}', 'Write a confident SMS about plants or displays that will make neighbors take notice. Keep it fun and slightly playful about standing out in the best way.');