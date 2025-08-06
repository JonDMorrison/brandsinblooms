-- Add geo-targeting columns to contacts
ALTER TABLE crm_customers 
ADD COLUMN postal_code TEXT,
ADD COLUMN country_code TEXT DEFAULT 'US',
ADD COLUMN city TEXT,
ADD COLUMN state_region TEXT,
ADD COLUMN lat NUMERIC,
ADD COLUMN lon NUMERIC,
ADD COLUMN usda_zone TEXT,
ADD COLUMN climate_zone TEXT,
ADD COLUMN geo_enriched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN geo_accuracy TEXT DEFAULT 'pending';

-- Create indexes for geo queries
CREATE INDEX idx_crm_customers_postal_code ON crm_customers(postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX idx_crm_customers_usda_zone ON crm_customers(usda_zone) WHERE usda_zone IS NOT NULL;
CREATE INDEX idx_crm_customers_city_state ON crm_customers(city, state_region) WHERE city IS NOT NULL AND state_region IS NOT NULL;

-- Create geo-targeting lookup tables
CREATE TABLE geo_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('usda', 'climate', 'region')),
  zone_name TEXT NOT NULL,
  description TEXT,
  min_temp_f INTEGER,
  max_temp_f INTEGER,
  typical_conditions TEXT,
  planting_guidance TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert USDA hardiness zones
INSERT INTO geo_zones (zone_code, zone_type, zone_name, description, min_temp_f, max_temp_f, planting_guidance) VALUES
('1a', 'usda', 'Zone 1a', 'Extremely cold, northern Canada', -60, -55, 'Only hardy perennials, very short growing season'),
('1b', 'usda', 'Zone 1b', 'Extremely cold', -55, -50, 'Limited growing options, focus on cold-resistant varieties'),
('2a', 'usda', 'Zone 2a', 'Very cold, Alaska/northern Canada', -50, -45, 'Short season vegetables, cold-hardy trees'),
('2b', 'usda', 'Zone 2b', 'Very cold', -45, -40, 'Cold-season crops, winter protection essential'),
('3a', 'usda', 'Zone 3a', 'Cold, northern states', -40, -35, 'Hardy perennials, cold-season vegetables'),
('3b', 'usda', 'Zone 3b', 'Cold', -35, -30, 'Extended growing season, some fruit trees'),
('4a', 'usda', 'Zone 4a', 'Moderately cold', -30, -25, 'Most vegetables, hardy fruit trees'),
('4b', 'usda', 'Zone 4b', 'Moderately cold', -25, -20, 'Good vegetable growing, deciduous trees'),
('5a', 'usda', 'Zone 5a', 'Cool, northern regions', -20, -15, 'Most common vegetables and fruits'),
('5b', 'usda', 'Zone 5b', 'Cool', -15, -10, 'Extended growing season, diverse plantings'),
('6a', 'usda', 'Zone 6a', 'Mild, transition zone', -10, -5, 'Wide variety of plants, good for beginners'),
('6b', 'usda', 'Zone 6b', 'Mild', -5, 0, 'Excellent growing conditions for most plants'),
('7a', 'usda', 'Zone 7a', 'Moderate, mid-Atlantic', 0, 5, 'Year-round growing possible, diverse options'),
('7b', 'usda', 'Zone 7b', 'Moderate', 5, 10, 'Long growing season, heat-tolerant varieties'),
('8a', 'usda', 'Zone 8a', 'Warm, southern regions', 10, 15, 'Warm-season crops, citrus possible'),
('8b', 'usda', 'Zone 8b', 'Warm', 15, 20, 'Tropical vegetables, extended harvest'),
('9a', 'usda', 'Zone 9a', 'Hot, southern states', 20, 25, 'Year-round gardening, tropical plants'),
('9b', 'usda', 'Zone 9b', 'Hot', 25, 30, 'Heat-loving varieties, winter growing'),
('10a', 'usda', 'Zone 10a', 'Very warm, southern Florida', 30, 35, 'Tropical gardening year-round'),
('10b', 'usda', 'Zone 10b', 'Very warm', 35, 40, 'Exotic tropical plants'),
('11a', 'usda', 'Zone 11a', 'Tropical, Hawaii/Keys', 40, 45, 'Tropical paradise gardening'),
('11b', 'usda', 'Zone 11b', 'Tropical', 45, 50, 'Ultimate tropical growing conditions');

-- Insert common climate zones
INSERT INTO geo_zones (zone_code, zone_type, zone_name, description, typical_conditions) VALUES
('Af', 'climate', 'Tropical Rainforest', 'Hot and wet year-round', 'High humidity, frequent rainfall'),
('Am', 'climate', 'Tropical Monsoon', 'Wet and dry seasons', 'Seasonal rainfall patterns'),
('Aw', 'climate', 'Tropical Savanna', 'Wet summer, dry winter', 'Distinct wet/dry seasons'),
('BWh', 'climate', 'Hot Desert', 'Very dry and hot', 'Minimal rainfall, extreme heat'),
('BWk', 'climate', 'Cold Desert', 'Very dry, cold winters', 'Low precipitation, temperature extremes'),
('BSh', 'climate', 'Hot Semi-Arid', 'Dry with hot summers', 'Limited rainfall, hot summers'),
('BSk', 'climate', 'Cold Semi-Arid', 'Dry with cold winters', 'Limited rainfall, cold winters'),
('Csa', 'climate', 'Mediterranean', 'Dry summer, wet winter', 'Ideal for Mediterranean crops'),
('Csb', 'climate', 'Warm Mediterranean', 'Mild, dry summers', 'Wine country climate'),
('Cfa', 'climate', 'Humid Subtropical', 'Hot summers, mild winters', 'Good for diverse agriculture'),
('Cfb', 'climate', 'Oceanic', 'Mild year-round', 'Consistent temperatures, regular rain'),
('Cfc', 'climate', 'Subpolar Oceanic', 'Cool summers', 'Short growing season'),
('Dfa', 'climate', 'Hot Summer Continental', 'Hot summers, cold winters', 'Four distinct seasons'),
('Dfb', 'climate', 'Warm Summer Continental', 'Warm summers, cold winters', 'Traditional four seasons'),
('Dfc', 'climate', 'Subarctic', 'Cool summers, very cold winters', 'Short growing season'),
('ET', 'climate', 'Tundra', 'Always cold', 'Permafrost, limited growing'),
('EF', 'climate', 'Ice Cap', 'Always freezing', 'No growing season');

-- Create targeting rules table for campaigns
CREATE TABLE campaign_targeting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID,
  automation_id UUID,
  rule_name TEXT NOT NULL,
  geo_filters JSONB DEFAULT '{}',
  demographic_filters JSONB DEFAULT '{}',
  estimated_reach INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_user_id UUID
);

-- Enable RLS on new tables
ALTER TABLE geo_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targeting_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for geo_zones (public read)
CREATE POLICY "Anyone can view geo zones" 
ON geo_zones FOR SELECT 
USING (true);

-- RLS policies for campaign_targeting_rules
CREATE POLICY "Users can manage targeting rules for their tenant" 
ON campaign_targeting_rules FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users u 
  WHERE u.tenant_id = campaign_targeting_rules.tenant_id 
  AND u.id = auth.uid()
));

-- Create update triggers
CREATE TRIGGER update_campaign_targeting_rules_updated_at
  BEFORE UPDATE ON campaign_targeting_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_targeting_rules_updated_at();

-- Create function for trigger
CREATE OR REPLACE FUNCTION update_campaign_targeting_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for targeting performance
CREATE INDEX idx_campaign_targeting_rules_tenant ON campaign_targeting_rules(tenant_id);
CREATE INDEX idx_campaign_targeting_rules_campaign ON campaign_targeting_rules(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_campaign_targeting_rules_automation ON campaign_targeting_rules(automation_id) WHERE automation_id IS NOT NULL;

-- Function to estimate segment reach
CREATE OR REPLACE FUNCTION estimate_geo_segment_reach(
  p_tenant_id UUID,
  p_geo_filters JSONB DEFAULT '{}',
  p_demographic_filters JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
  result_count INTEGER;
BEGIN
  -- Build dynamic query based on filters
  query_text := 'SELECT COUNT(*) FROM crm_customers WHERE tenant_id = $1 AND opt_out = false';
  
  -- Add geo filters
  IF p_geo_filters ? 'postal_codes' THEN
    query_text := query_text || ' AND postal_code = ANY($2::text[])';
  END IF;
  
  IF p_geo_filters ? 'usda_zones' THEN
    query_text := query_text || ' AND usda_zone = ANY($3::text[])';
  END IF;
  
  IF p_geo_filters ? 'cities' THEN
    query_text := query_text || ' AND city = ANY($4::text[])';
  END IF;
  
  IF p_geo_filters ? 'states' THEN
    query_text := query_text || ' AND state_region = ANY($5::text[])';
  END IF;
  
  -- For now, execute a simple version
  EXECUTE 'SELECT COUNT(*) FROM crm_customers WHERE tenant_id = $1 AND opt_out = false'
  INTO result_count
  USING p_tenant_id;
  
  RETURN result_count;
END;
$$;