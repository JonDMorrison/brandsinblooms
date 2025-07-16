-- Create personas table with full marketing and tone data
CREATE TABLE public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tone TEXT NOT NULL,
  description TEXT NOT NULL,
  buying_triggers TEXT[] DEFAULT '{}',
  sample_phrases TEXT[] DEFAULT '{}',
  ideal_products TEXT[] DEFAULT '{}',
  icon TEXT DEFAULT '🌿',
  color_theme TEXT DEFAULT '#22C55E',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- Create policies for personas (readable by all authenticated users)
CREATE POLICY "Authenticated users can view personas" 
ON public.personas 
FOR SELECT 
USING (true);

-- Add persona_id foreign key to crm_customers
ALTER TABLE public.crm_customers 
ADD COLUMN persona_id UUID REFERENCES public.personas(id);

-- Insert the 9 refined personas
INSERT INTO public.personas (name, tone, description, buying_triggers, sample_phrases, ideal_products, icon, color_theme) VALUES
(
  'Plant-Killer Pam',
  'encouraging, supportive, non-judgmental',
  'New to gardening and worried about killing plants. Needs foolproof, low-maintenance options and lots of reassurance.',
  ARRAY['low maintenance', 'easy care', 'beginner', 'hard to kill', 'drought tolerant'],
  ARRAY['You''ve got this!', 'Perfect for beginners', 'Nearly impossible to kill'],
  ARRAY['succulents', 'snake plants', 'pothos', 'ZZ plants'],
  '🌱',
  '#10B981'
),
(
  'Pet-Friendly Hannah',
  'caring, protective, family-focused',
  'Prioritizes pet safety above all. Needs non-toxic plants and pet-safe gardening solutions.',
  ARRAY['pet safe', 'non-toxic', 'dog friendly', 'cat safe', 'pet approved'],
  ARRAY['Safe for furry friends', 'Pet-approved gardening', 'Your pets will love this too'],
  ARRAY['spider plants', 'Boston ferns', 'pet grass', 'catnip'],
  '🐕',
  '#8B5CF6'
),
(
  'Vegetable Garden Veronica',
  'practical, health-conscious, productive',
  'Focused on growing food for the family. Values nutrition, freshness, and self-sufficiency.',
  ARRAY['vegetables', 'herbs', 'edible', 'organic', 'harvest', 'food garden'],
  ARRAY['Fresh from your garden', 'Grow your own food', 'Garden to table'],
  ARRAY['tomatoes', 'herbs', 'lettuce', 'peppers', 'composting supplies'],
  '🥕',
  '#F59E0B'
),
(
  'Sustainable Susie',
  'environmentally conscious, ethical, purposeful',
  'Committed to eco-friendly practices. Seeks native plants, organic solutions, and sustainable gardening methods.',
  ARRAY['native', 'organic', 'sustainable', 'eco-friendly', 'natural', 'chemical-free'],
  ARRAY['Good for the planet', 'Sustainably grown', 'Earth-friendly choice'],
  ARRAY['native plants', 'organic fertilizers', 'rain barrels', 'compost bins'],
  '🌍',
  '#059669'
),
(
  'Patio Gardener Gail',
  'space-savvy, creative, apartment-friendly',
  'Lives in small spaces but loves to garden. Needs container solutions and compact growing options.',
  ARRAY['container', 'small space', 'patio', 'apartment', 'compact', 'portable'],
  ARRAY['Perfect for small spaces', 'Patio paradise', 'Big impact, small footprint'],
  ARRAY['containers', 'hanging baskets', 'vertical planters', 'compact varieties'],
  '🏠',
  '#EF4444'
),
(
  'Pollinator Paula',
  'nature-loving, bee-conscious, ecosystem-minded',
  'Passionate about supporting bees, butterflies, and wildlife. Seeks plants that benefit pollinators.',
  ARRAY['pollinator', 'bee friendly', 'butterfly', 'native', 'wildlife', 'habitat'],
  ARRAY['Bees love this!', 'Support pollinators', 'Wildlife approved'],
  ARRAY['bee balm', 'milkweed', 'lavender', 'pollinator mixes'],
  '🐝',
  '#F97316'
),
(
  'Curb Appeal Ashley',
  'stylish, confident, trend-aware',
  'Focused on making a beautiful first impression. Values aesthetics, design, and keeping up with trends.',
  ARRAY['curb appeal', 'landscape', 'design', 'beautiful', 'trendy', 'colorful'],
  ARRAY['Make your neighbors jealous', 'Instagram-worthy', 'Stunning curb appeal'],
  ARRAY['flowering shrubs', 'ornamental grasses', 'seasonal displays', 'planters'],
  '✨',
  '#EC4899'
),
(
  'DIY Dana',
  'hands-on, creative, project-oriented',
  'Loves garden projects and crafts. Enjoys making things from scratch and learning new techniques.',
  ARRAY['DIY', 'project', 'craft', 'workshop', 'make', 'build', 'creative'],
  ARRAY['Perfect DIY project', 'Get your hands dirty', 'Make it yourself'],
  ARRAY['craft supplies', 'workshop kits', 'tools', 'project materials'],
  '🔨',
  '#6366F1'
),
(
  'Wellness Whitney',
  'health-focused, mindful, therapeutic',
  'Gardens for mental health and wellness. Interested in aromatherapy, meditation gardens, and therapeutic plants.',
  ARRAY['wellness', 'aromatherapy', 'meditation', 'therapeutic', 'stress relief', 'mindful'],
  ARRAY['Good for the soul', 'Natural stress relief', 'Mindful gardening'],
  ARRAY['lavender', 'chamomile', 'mint', 'meditation garden kits'],
  '🧘',
  '#14B8A6'
);