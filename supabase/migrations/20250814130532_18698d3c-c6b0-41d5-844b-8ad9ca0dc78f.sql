-- Add test phone numbers to company profile for SMS testing
UPDATE company_profiles 
SET test_numbers = ARRAY['6048393258', '6041234567'] 
WHERE user_id = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac';