-- Set up test profile with valid location data
UPDATE company_profiles
SET 
  postal_code = '90210',
  location_needs_confirmation = false,
  location_detection_source = 'manual'
WHERE id = '4b51184f-4a0c-455f-8b28-456eba7c06ec';