-- Add granular typography font columns to company_profiles
ALTER TABLE company_profiles
ADD COLUMN headline_font_id UUID REFERENCES available_fonts(id) DEFAULT NULL,
ADD COLUMN subheading_font_id UUID REFERENCES available_fonts(id) DEFAULT NULL,
ADD COLUMN body_font_id UUID REFERENCES available_fonts(id) DEFAULT NULL,
ADD COLUMN button_font_id UUID REFERENCES available_fonts(id) DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN company_profiles.selected_font_id IS 'Legacy single font - kept for backwards compatibility';
COMMENT ON COLUMN company_profiles.headline_font_id IS 'Font for main headlines (H1)';
COMMENT ON COLUMN company_profiles.subheading_font_id IS 'Font for subheadings (H2, H3)';
COMMENT ON COLUMN company_profiles.body_font_id IS 'Font for body text and paragraphs';
COMMENT ON COLUMN company_profiles.button_font_id IS 'Font for CTA buttons and links';