-- Add first_purchase_date column to crm_customers if it doesn't exist
ALTER TABLE public.crm_customers 
ADD COLUMN IF NOT EXISTS first_purchase_date DATE;

-- Add index for faster trigger queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_first_purchase_date 
ON public.crm_customers(first_purchase_date) 
WHERE first_purchase_date IS NOT NULL;

-- Add index for order.completed trigger queries
CREATE INDEX IF NOT EXISTS idx_crm_customers_last_purchase_date 
ON public.crm_customers(last_purchase_date) 
WHERE last_purchase_date IS NOT NULL;