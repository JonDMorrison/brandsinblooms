-- Create available_fonts table
CREATE TABLE available_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  google_fonts_url TEXT NOT NULL,
  font_family_css TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE available_fonts ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view active fonts
CREATE POLICY "Anyone can view available fonts"
  ON available_fonts FOR SELECT
  USING (is_active = true);

-- Insert initial fonts
INSERT INTO available_fonts (name, display_name, google_fonts_url, font_family_css, sort_order) VALUES
('quicksand', 'Quicksand (Current Default)', 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap', '''Quicksand'', sans-serif', 0),
('roboto', 'Roboto', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap', '''Roboto'', sans-serif', 1),
('open-sans', 'Open Sans', 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap', '''Open Sans'', sans-serif', 2),
('lato', 'Lato', 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap', '''Lato'', sans-serif', 3),
('montserrat', 'Montserrat', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap', '''Montserrat'', sans-serif', 4),
('merriweather', 'Merriweather', 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap', '''Merriweather'', serif', 5),
('nunito', 'Nunito', 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap', '''Nunito'', sans-serif', 6);

-- Add selected_font_id column to company_profiles
ALTER TABLE company_profiles
ADD COLUMN selected_font_id UUID REFERENCES available_fonts(id) DEFAULT NULL;