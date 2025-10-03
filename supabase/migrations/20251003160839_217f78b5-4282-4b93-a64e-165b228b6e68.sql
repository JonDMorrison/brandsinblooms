
-- Extend Dan Miller's trial to 6 months from start date
UPDATE public.subscriptions
SET 
  end_date = start_date + INTERVAL '6 months',
  updated_at = now()
WHERE user_id IN (
  '804e0064-73fc-46c5-9b03-d47e14ff9a41',
  '2176f5d5-dad0-4881-a306-a7522603431d'
);
