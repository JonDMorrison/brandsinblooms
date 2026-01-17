INSERT INTO crm_outbox (
  tenant_id,
  automation_id,
  automation_run_id,
  customer_id,
  message_type,
  recipient,
  subject,
  content,
  status,
  scheduled_at,
  step_index
) VALUES (
  '13b62ff0-4dc0-4451-a851-bb142a25ea62',
  '08b67f27-b802-4499-bd3f-0e8925e0e11f',
  '16e6b3e4-7c94-4ccf-903c-73d895daef8b',
  '5ac20588-ed15-42ee-87ab-bfedac0ad269',
  'email',
  'furqanhameedjutt.311@gmail.com',
  'Welcome to Down to Earth Perks',
  'Thanks for signing up for Down to Earth Perks. 
We''re glad you''re here!
As a Perks member, you''ll earn rewards on your purchases, receive early access to sales and events, and get exclusive offers throughout the year.
There''s nothing extra you need to do to get started. Just shop like you normally would, and your rewards will add up automatically. For every $1 spent = 1 perk point!
Thank you for being part of our community. 
Let''s grow together!
The Shops of Down to Earth',
  'queued',
  NOW(),
  1
);