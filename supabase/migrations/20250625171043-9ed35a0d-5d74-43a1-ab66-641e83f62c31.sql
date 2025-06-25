
-- Deactivate "National Ice Cream Month" holiday as it doesn't provide good garden-relevant content
UPDATE public.holidays 
SET is_active = false, updated_at = now()
WHERE holiday_name = 'National Ice Cream Month' 
AND is_active = true;
