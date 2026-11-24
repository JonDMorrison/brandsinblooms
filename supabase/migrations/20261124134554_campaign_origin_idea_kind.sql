-- newsletter-qa2 #4: drafts started from "Pick an idea" record origin idea:<id>.
-- Widens the allowed kinds; every existing value stays valid.
ALTER TABLE public.crm_campaigns DROP CONSTRAINT IF EXISTS crm_campaigns_origin_format_check;
ALTER TABLE public.crm_campaigns ADD CONSTRAINT crm_campaigns_origin_format_check CHECK (
  origin IS NULL OR origin ~ '^(blank|weekly_theme|saved_template|starter_template|holiday|persona|duplicate|review|website_import|ai|calendar|automation|idea)(:[A-Za-z0-9_.:-]{1,200})?$'
);
