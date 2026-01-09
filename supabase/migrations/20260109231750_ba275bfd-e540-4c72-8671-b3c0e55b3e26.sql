-- Set default sender email for the verified dwn2earth.com domain
UPDATE email_domains
SET 
  default_from_email = 'hello@dwn2earth.com',
  default_from_name = 'Down to Earth Garden Center'
WHERE id = 'b88ac159-acb2-4d0c-ba81-8ab809219c4d'
  AND tenant_id = '13b62ff0-4dc0-4451-a851-bb142a25ea62';